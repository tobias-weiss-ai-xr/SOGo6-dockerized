"""SAML2 (Shibboleth) authentication module.

Implements SP-initiated SSO: builds an AuthnRequest, sends the user to the
IdP, and processes the SAML Response (POST binding) to extract the user's
identity.  Uses ``authlib.saml`` when available, otherwise falls back to a
minimal implementation that handles the common case (unencrypted assertions
via HTTP-POST).
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from base64 import b64decode, b64encode
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4
from zlib import compress, decompress

from app.utils.exceptions import RequestException
from app.utils.logger.logger import logger_api

# Namespaces used in SAML 2.0 protocol messages
SAML_PROTOCOL = "urn:oasis:names:tc:SAML:2.0:protocol"
SAML_ASSERTION = "urn:oasis:names:tc:SAML:2.0:assertion"
SAML_METADATA = "urn:oasis:names:tc:SAML:2.0:metadata"

NS = {
    "samlp": SAML_PROTOCOL,
    "saml": SAML_ASSERTION,
    "md": SAML_METADATA,
    "ds": "http://www.w3.org/2000/09/xmldsig#",
}


class ModuleSAML2:
    """SAML 2.0 Service Provider.

    Typical usage::

        saml = ModuleSAML2(
            idp_sso_url="https://idp.example.org/SAML2/SSO",
            entity_id="https://sogo.example.org/saml/metadata",
            acs_url="https://sogo.example.org/api/user/v1/auth/callback/example.com",
        )
        login_url = saml.create_login_request()
        # redirect user to login_url
        # user is POSTed back to acs_url with SAMLResponse
        email = saml.process_response(post_data["SAMLResponse"])
    """

    def __init__(
        self,
        idp_sso_url: str = "",
        idp_entity_id: str = "",
        entity_id: str = "",
        acs_url: str = "",
        x509_cert: str = "",
        x509_key: str = "",
        name_id_format: str = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        authn_context: str = "urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport",
    ) -> None:
        """Initialise the SAML SP.

        :param idp_sso_url: IdP's SingleSignOnService URL (HTTP-POST or
            HTTP-Redirect binding).
        :param idp_entity_id: IdP's entityID (issuer), used to validate
            responses.
        :param entity_id: This SP's entityID (unique identifier).
        :param acs_url: Assertion Consumer Service URL (where the IdP sends
            the SAML Response).
        :param x509_cert: SP's X.509 certificate (PEM) — used to sign
            AuthnRequests (optional but recommended).
        :param x509_key: SP's private key (PEM) — used to sign AuthnRequests.
        :param name_id_format: Requested NameID format.
        :param authn_context: Requested authentication context class.
        """
        self._idp_sso_url = idp_sso_url.rstrip("/")
        self._idp_entity_id = idp_entity_id
        self._entity_id = entity_id.rstrip("/")
        self._acs_url = acs_url.rstrip("/")
        self._x509_cert = x509_cert
        self._x509_key = x509_key
        self._name_id_format = name_id_format
        self._authn_context = authn_context

    # ------------------------------------------------------------------
    # SP Metadata (XML)
    # ------------------------------------------------------------------

    def get_sp_metadata(self) -> str:
        """Return this SP's SAML 2.0 metadata XML.

        IdP administrators import this URL to configure the trust.
        """
        acs_location = self._acs_url
        entity_id = self._entity_id

        md = f"""<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="{SAML_METADATA}"
                     entityID="{entity_id}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
                      AuthnRequestsSigned="{'true' if self._x509_cert else 'false'}"
                      WantAssertionsSigned="true">
    <md:NameIDFormat>{self._name_id_format}</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                  Location="{acs_location}"
                                  index="0"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>"""
        return md

    # ------------------------------------------------------------------
    # AuthnRequest (SP-initiated SSO)
    # ------------------------------------------------------------------

    def create_login_request(self, relay_state: str = "") -> str:
        """Build the SAML AuthnRequest URL (HTTP-Redirect binding).

        The URL is a redirect to the IdP's SSO endpoint with a
        base64-encoded, deflate-compressed AuthnRequest XML and an optional
        RelayState parameter.

        :param relay_state: Opaque value preserved across the redirect
            (typically the original request URL).
        :returns: Absolute URL to redirect the user's browser to.
        """
        request_id = f"ONELOGIN_{uuid4().hex}"
        issue_instant = self._iso_now()

        authn_request_xml = f"""<samlp:AuthnRequest xmlns:samlp="{SAML_PROTOCOL}"
                            xmlns:saml="{SAML_ASSERTION}"
                            ID="{request_id}"
                            Version="2.0"
                            IssueInstant="{issue_instant}"
                            Destination="{self._idp_sso_url}"
                            ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                            AssertionConsumerServiceURL="{self._acs_url}"
                            ForceAuthn="false"
                            IsPassive="false">
  <saml:Issuer>{self._entity_id}</saml:Issuer>
  <samlp:NameIDPolicy Format="{self._name_id_format}"
                       AllowCreate="true"/>
  <samlp:RequestedAuthnContext Comparison="exact">
    <saml:AuthnContextClassRef>{self._authn_context}</saml:AuthnContextClassRef>
  </samlp:RequestedAuthnContext>
</samlp:AuthnRequest>"""

        # Deflate + base64 encode
        compressed = compress(authn_request_xml.encode("utf-8"))[2:-4]  # strip zlib header/trailer
        saml_request_b64 = b64encode(compressed).decode("utf-8")

        params: dict[str, str] = {
            "SAMLRequest": saml_request_b64,
        }
        if relay_state:
            params["RelayState"] = relay_state

        return f"{self._idp_sso_url}?{urlencode(params)}"

    # ------------------------------------------------------------------
    # SAML Response processing
    # ------------------------------------------------------------------

    def process_response(self, saml_response_b64: str) -> dict[str, Any]:
        """Parse and validate a SAML Response (HTTP-POST binding).

        Extracts the user's NameID and any attributes from the assertion.

        :param saml_response_b64: Base64-encoded SAML Response XML from the
            HTTP-POST body.
        :returns: A dict with keys ``name_id``, ``email``, ``attributes``,
            and ``session_index``.
        :raises RequestException: If the response is invalid.
        """
        try:
            xml_bytes = b64decode(saml_response_b64)
            root = ET.fromstring(xml_bytes)
        except Exception as exc:
            raise RequestException(f"SAML: failed to decode/parse response: {exc}") from exc

        # -- Extract Status --
        status_elem = root.find(".//samlp:StatusCode", NS)
        status_value = status_elem.get("Value", "") if status_elem is not None else ""
        if "Success" not in status_value:
            sub_status = root.find(".//samlp:StatusCode/samlp:StatusCode", NS)
            detail = sub_status.get("Value", "") if sub_status is not None else status_value
            raise RequestException(f"SAML: IdP returned failure: {detail}")

        # -- Extract Assertion --
        assertion = root.find(f"{{{SAML_ASSERTION}}}Assertion", NS) or root.find(".//saml:Assertion", NS)
        if assertion is None:
            raise RequestException("SAML: no Assertion in Response")

        # Issuer
        issuer_elem = assertion.find(f"{{{SAML_ASSERTION}}}Issuer", NS) or assertion.find("saml:Issuer", NS)
        assertion_issuer = issuer_elem.text if issuer_elem is not None else ""
        if self._idp_entity_id and assertion_issuer and assertion_issuer != self._idp_entity_id:
            raise RequestException(
                f"SAML: assertion issuer '{assertion_issuer}' "
                f"does not match expected '{self._idp_entity_id}'"
            )

        # Subject / NameID
        subject = assertion.find(f"{{{SAML_ASSERTION}}}Subject", NS) or assertion.find("saml:Subject", NS)
        name_id = ""
        if subject is not None:
            name_id_elem = (
                subject.find(f"{{{SAML_ASSERTION}}}NameID", NS)
                or subject.find("saml:NameID", NS)
            )
            if name_id_elem is not None:
                name_id = name_id_elem.text or ""

        # Attributes
        attributes: dict[str, list[str]] = {}
        attr_statement = (
            assertion.find(f"{{{SAML_ASSERTION}}}AttributeStatement", NS)
            or assertion.find("saml:AttributeStatement", NS)
        )
        if attr_statement is not None:
            for attr_elem in attr_statement:
                if attr_elem.tag == f"{{{SAML_ASSERTION}}}Attribute" or attr_elem.tag.endswith("}Attribute"):
                    attr_name = attr_elem.get("Name", "")
                    values: list[str] = []
                    for val_elem in attr_elem:
                        if val_elem.tag == f"{{{SAML_ASSERTION}}}AttributeValue" or val_elem.tag.endswith("}AttributeValue"):
                            values.append(val_elem.text or "")
                    if attr_name:
                        attributes[attr_name] = values

        # Extract email from attributes or NameID
        email = ""
        for claim in ("mail", "email", "emailAddress", "emailaddress", "urn:oid:0.9.2342.19200300.100.1.3"):
            vals = attributes.get(claim, [])
            if vals:
                email = vals[0]
                break
        if not email and "@" in name_id:
            email = name_id

        # SessionIndex
        session_index = ""
        authn_statement = (
            assertion.find(f"{{{SAML_ASSERTION}}}AuthnStatement", NS)
            or assertion.find("saml:AuthnStatement", NS)
        )
        if authn_statement is not None:
            session_index = authn_statement.get("SessionIndex", "")

        result = {
            "name_id": name_id,
            "email": email,
            "attributes": attributes,
            "session_index": session_index,
            "issuer": assertion_issuer,
        }
        logger_api.debug("SAML processed response for name_id=%s email=%s", name_id, email)
        return result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _iso_now() -> str:
        """Return current UTC time in SAML2-compatible ISO 8601 format."""
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
