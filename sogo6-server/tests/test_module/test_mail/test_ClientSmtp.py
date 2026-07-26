"""
Unit tests for ClientSmtp (SMTP client module).
Tests all encryption modes (PLAIN, EXPLICIT_TLS, IMPLICIT_TLS),
all auth mechanisms (None, plain, xoauth2, oauthbearer), and error paths using monkeypatched smtplib.
"""
from __future__ import annotations

import smtplib
import base64
from email.message import Message
from unittest.mock import MagicMock
from socket import timeout as sock_timeout, gaierror
from ssl import SSLError

import pytest

from app.manager.outgoing.ClientSmtp import ClientSmtp
from app.utils import constants as cs
from app.utils.exceptions import BugException, RequestException


# ---------------------------------------------------------------------------
# Helper: build a mock smtplib.SMTP instance with esmtp_features
# ---------------------------------------------------------------------------

def _mock_smtp_instance() -> MagicMock:
    """Return a plain MagicMock that looks like an SMTP instance with esmtp_features."""
    instance = MagicMock()
    instance.esmtp_features = {"SIZE": "35882577"}
    return instance


def _mock_smtp_ssl_instance() -> MagicMock:
    """Return a plain MagicMock that looks like an SMTP_SSL instance with esmtp_features."""
    instance = MagicMock()
    instance.esmtp_features = {"SIZE": "35882577"}
    return instance


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def smtp_plain() -> ClientSmtp:
    """SMTP client configured for PLAIN (no encryption)."""
    return ClientSmtp("smtp.example.com", 25, cs.SOCKET_ENC_PLAIN, "plain")


@pytest.fixture
def smtp_explicit_tls() -> ClientSmtp:
    """SMTP client configured for EXPLICIT TLS (StartTLS)."""
    return ClientSmtp("smtp.example.com", 587, cs.SOCKET_ENC_EXPLICIT_TLS, "plain")


@pytest.fixture
def smtp_implicit_tls() -> ClientSmtp:
    """SMTP client configured for IMPLICIT TLS (SSL/TLS)."""
    return ClientSmtp("smtp.example.com", 465, cs.SOCKET_ENC_IMPLICIT_TLS, "plain")


# ---------------------------------------------------------------------------
# Connect — PLAIN encryption
# ---------------------------------------------------------------------------

class TestConnectPlain:
    """Tests for ``connect()`` with ``SOCKET_ENC_PLAIN``."""

    def test_connect_success(self, smtp_plain, mocker):
        """Connect succeeds with plain SMTP."""
        mock_conn = mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())

        smtp_plain.connect()

        mock_conn.assert_called_once_with("smtp.example.com", 25)
        mock_conn.return_value.ehlo.assert_called_once()
        assert smtp_plain.connected is True

    def test_connect_connect_error(self, smtp_plain, mocker):
        """Connect raises RequestException on SMTPConnectError."""
        mocker.patch("smtplib.SMTP", side_effect=smtplib.SMTPConnectError(421, "Service unavailable"))

        with pytest.raises(RequestException, match="Service unavailable"):
            smtp_plain.connect()

    def test_connect_server_disconnected(self, smtp_plain, mocker):
        """Connect raises RequestException on SMTPServerDisconnected."""
        mocker.patch("smtplib.SMTP", side_effect=smtplib.SMTPServerDisconnected("Connection lost"))

        with pytest.raises(RequestException, match="Connection lost"):
            smtp_plain.connect()

    def test_connect_gaierror(self, smtp_plain, mocker):
        """Connect raises RequestException on gaierror."""
        mocker.patch("smtplib.SMTP", side_effect=gaierror("Name or service not known"))

        with pytest.raises(RequestException, match="Name or service not known"):
            smtp_plain.connect()

    def test_connect_timeout(self, smtp_plain, mocker):
        """Connect raises RequestException on socket timeout."""
        mocker.patch("smtplib.SMTP", side_effect=sock_timeout("timed out"))

        with pytest.raises(RequestException, match="timed out"):
            smtp_plain.connect()

    def test_connect_connection_refused(self, smtp_plain, mocker):
        """Connect raises RequestException on ConnectionRefusedError."""
        mocker.patch("smtplib.SMTP", side_effect=ConnectionRefusedError("Connection refused"))

        with pytest.raises(RequestException, match="Connection refused"):
            smtp_plain.connect()

    def test_connect_ssl_error(self, smtp_plain, mocker):
        """Connect raises RequestException on SSLError."""
        mocker.patch("smtplib.SMTP", side_effect=SSLError("SSL handshake failed"))

        with pytest.raises(RequestException, match="SSL handshake failed"):
            smtp_plain.connect()


# ---------------------------------------------------------------------------
# Connect — EXPLICIT TLS (StartTLS)
# ---------------------------------------------------------------------------

class TestConnectExplicitTLS:
    """Tests for ``connect()`` with ``SOCKET_ENC_EXPLICIT_TLS``."""

    def test_connect_success(self, smtp_explicit_tls, mocker):
        """Connect and starttls succeed."""
        mock_conn = mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        instance = mock_conn.return_value

        smtp_explicit_tls.connect()

        mock_conn.assert_called_once_with("smtp.example.com", 587)
        instance.starttls.assert_called_once()
        instance.ehlo.assert_called_once()
        assert smtp_explicit_tls.connected is True


# ---------------------------------------------------------------------------
# Connect — IMPLICIT TLS (SSL/TLS)
# ---------------------------------------------------------------------------

class TestConnectImplicitTLS:
    """Tests for ``connect()`` with ``SOCKET_ENC_IMPLICIT_TLS``."""

    def test_connect_success(self, smtp_implicit_tls, mocker):
        """Connect succeeds with SMTP_SSL."""
        mock_conn = mocker.patch("smtplib.SMTP_SSL", return_value=_mock_smtp_ssl_instance())

        smtp_implicit_tls.connect()

        mock_conn.assert_called_once_with("smtp.example.com", 465)
        mock_conn.return_value.ehlo.assert_called_once()
        assert smtp_implicit_tls.connected is True


# ---------------------------------------------------------------------------
# Connect — unknown encryption
# ---------------------------------------------------------------------------

class TestConnectUnknownEncryption:
    """Tests for ``connect()`` with an unsupported encryption type."""

    def test_unknown_encryption_raises_bug(self, mocker):
        """Unknown encryption string raises BugException."""
        client = ClientSmtp("smtp.example.com", 25, "UNKNOWN", "plain")
        with pytest.raises(BugException, match="Unknown encryption given: UNKNOWN"):
            client.connect()


# ---------------------------------------------------------------------------
# Login — None
# ---------------------------------------------------------------------------

class TestLoginNone:
    """Tests for ``login()`` with auth_mech='None'."""

    def test_login_no_auth(self, smtp_plain, mocker):
        """No-auth login succeeds without calling any AUTH command."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.auth_mech = "None"

        smtp_plain.login("user@example.com", "password")

        assert smtp_plain.authenticated is True
        # docmd should NOT have been called for auth
        smtp_plain.connection.docmd.assert_not_called()


# ---------------------------------------------------------------------------
# Login — PLAIN
# ---------------------------------------------------------------------------

class TestLoginPlain:
    """Tests for ``login()`` with auth_mech='plain'."""

    def test_login_plain(self, smtp_plain, mocker):
        """Plain auth sends correct AUTH PLAIN command."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()

        smtp_plain.login("user@example.com", "secret123")

        expected_creds = base64.b64encode(
            b"user@example.com\x00user@example.com\x00secret123"
        ).decode()
        smtp_plain.connection.docmd.assert_called_once_with("AUTH", f"PLAIN {expected_creds}")
        assert smtp_plain.authenticated is True

    def test_login_plain_with_authname(self, smtp_plain, mocker):
        """Plain auth with explicit authname uses authname as authcid."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()

        smtp_plain.login("user@example.com", "secret123", authname="authz@example.com")

        expected_creds = base64.b64encode(
            b"user@example.com\x00authz@example.com\x00secret123"
        ).decode()
        smtp_plain.connection.docmd.assert_called_once_with("AUTH", f"PLAIN {expected_creds}")

    def test_login_plain_auth_error(self, smtp_plain, mocker):
        """Plain auth raises RequestException on SMTPAuthenticationError."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.connection.docmd.side_effect = smtplib.SMTPAuthenticationError(535, "Authentication failed")

        with pytest.raises(RequestException, match="Authentication failed"):
            smtp_plain.login("user@example.com", "wrong")


# ---------------------------------------------------------------------------
# Login — XOAUTH2
# ---------------------------------------------------------------------------

class TestLoginXoauth2:
    """Tests for ``login()`` with auth_mech='xoauth2'."""

    def test_login_xoauth2(self, smtp_explicit_tls, mocker):
        """XOAUTH2 auth sends correct AUTH XOAUTH2 command."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_explicit_tls.connect()
        smtp_explicit_tls.auth_mech = "xoauth2"

        smtp_explicit_tls.login("user@example.com", "bearer_token_123")

        expected = base64.b64encode(
            b"user=user@example.com\x01auth=Bearer bearer_token_123\x01\x01"
        ).decode()
        smtp_explicit_tls.connection.docmd.assert_called_once_with("AUTH", f"XOAUTH2 {expected}")
        assert smtp_explicit_tls.authenticated is True


# ---------------------------------------------------------------------------
# Login — OAUTHBEARER
# ---------------------------------------------------------------------------

class TestLoginOauthbearer:
    """Tests for ``login()`` with auth_mech='oauthbearer'."""

    def test_login_oauthbearer(self, smtp_explicit_tls, mocker):
        """OAUTHBEARER auth sends correct AUTH OAUTHBEARER command."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_explicit_tls.connect()
        smtp_explicit_tls.auth_mech = "oauthbearer"

        smtp_explicit_tls.login("user@example.com", "bearer_token_456")

        expected = base64.b64encode(
            b"n,a=user@example.com,\x01host=smtp.example.com\x01port=587\x01"
            b"auth=Bearer bearer_token_456\x01\x01"
        ).decode()
        smtp_explicit_tls.connection.docmd.assert_called_once_with("AUTH", f"OAUTHBEARER {expected}")
        assert smtp_explicit_tls.authenticated is True


# ---------------------------------------------------------------------------
# Login — unknown auth mechanism
# ---------------------------------------------------------------------------

class TestLoginUnknownAuth:
    """Tests for ``login()`` with an unsupported auth mechanism."""

    def test_unknown_auth_raises_bug(self, smtp_plain, mocker):
        """Unsupported auth mechanism raises BugException."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.auth_mech = "cram-md5"

        with pytest.raises(BugException, match="Unsupported SMTP authentication mechanism: cram-md5"):
            smtp_plain.login("user@example.com", "pwd")

    def test_login_without_connection_raises_bug(self, smtp_plain):
        """Login without connecting first raises BugException."""
        with pytest.raises(BugException, match="Cannot login: not connected"):
            smtp_plain.login("user@example.com", "pwd")


# ---------------------------------------------------------------------------
# Login — error paths
# ---------------------------------------------------------------------------

class TestLoginErrors:
    """Tests for error handling during login."""

    def test_login_response_error(self, smtp_plain, mocker):
        """Login raises RequestException on SMTPResponseException."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.connection.docmd.side_effect = smtplib.SMTPResponseException(500, "Command rejected")

        with pytest.raises(RequestException, match="Command rejected"):
            smtp_plain.login("user@example.com", "pwd")

    def test_login_smtp_exception(self, smtp_plain, mocker):
        """Login raises RequestException on generic SMTPException."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.connection.docmd.side_effect = smtplib.SMTPException("Generic SMTP error")

        with pytest.raises(RequestException, match="Generic SMTP error"):
            smtp_plain.login("user@example.com", "pwd")


# ---------------------------------------------------------------------------
# Send mail
# ---------------------------------------------------------------------------

class TestSendMail:
    """Tests for ``send_mail()``."""

    def test_send_mail_success(self, smtp_plain, mocker):
        """Sending a message succeeds."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        msg = Message()
        msg["Subject"] = "Test"
        msg.set_payload("Body")

        smtp_plain.send_mail(msg)

        smtp_plain.connection.send_message.assert_called_once_with(msg)

    def test_send_mail_without_connection(self, smtp_plain):
        """Sending without a connection raises BugException."""
        msg = Message()
        msg["Subject"] = "Test"
        msg.set_payload("Body")

        with pytest.raises(BugException, match="Cannot send mail: not connected"):
            smtp_plain.send_mail(msg)

    def test_send_mail_auth_error(self, smtp_plain, mocker):
        """Sending raises on SMTPAuthenticationError."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.connection.send_message.side_effect = smtplib.SMTPAuthenticationError(535, "Auth fail")
        msg = Message()
        msg.set_payload("Body")

        with pytest.raises(RequestException, match="Auth fail"):
            smtp_plain.send_mail(msg)

    def test_send_mail_server_disconnected(self, smtp_plain, mocker):
        """Sending raises on SMTPServerDisconnected."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.connection.send_message.side_effect = smtplib.SMTPServerDisconnected("Disconnected")
        msg = Message()
        msg.set_payload("Body")

        with pytest.raises(RequestException, match="Disconnected"):
            smtp_plain.send_mail(msg)

    def test_send_mail_recipients_refused(self, smtp_plain, mocker):
        """Sending raises on SMTPRecipientsRefused."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.connection.send_message.side_effect = smtplib.SMTPRecipientsRefused({"user@bad.com": (550, "User unknown")})
        msg = Message()
        msg.set_payload("Body")

        with pytest.raises(RequestException):
            smtp_plain.send_mail(msg)

    def test_send_mail_sender_refused(self, smtp_plain, mocker):
        """Sending raises on SMTPSenderRefused."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.connection.send_message.side_effect = smtplib.SMTPSenderRefused(550, "Sender denied", "bad@example.com")
        msg = Message()
        msg.set_payload("Body")

        with pytest.raises(RequestException):
            smtp_plain.send_mail(msg)

    def test_send_mail_data_error(self, smtp_plain, mocker):
        """Sending raises on SMTPDataError."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.connection.send_message.side_effect = smtplib.SMTPDataError(554, "Data rejected")
        msg = Message()
        msg.set_payload("Body")

        with pytest.raises(RequestException, match="Data rejected"):
            smtp_plain.send_mail(msg)

    def test_send_mail_response_error(self, smtp_plain, mocker):
        """Sending raises on SMTPResponseException."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.connection.send_message.side_effect = smtplib.SMTPResponseException(500, "Response error")
        msg = Message()
        msg.set_payload("Body")

        with pytest.raises(RequestException, match="Response error"):
            smtp_plain.send_mail(msg)

    def test_send_mail_smtp_exception(self, smtp_plain, mocker):
        """Sending raises on generic SMTPException."""
        mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        smtp_plain.connect()
        smtp_plain.connection.send_message.side_effect = smtplib.SMTPException("Generic error")
        msg = Message()
        msg.set_payload("Body")

        with pytest.raises(RequestException, match="Generic error"):
            smtp_plain.send_mail(msg)


# ---------------------------------------------------------------------------
# Full integration scenario (mocked)
# ---------------------------------------------------------------------------

class TestFullScenario:
    """Test a full connect → login → send scenario with mocks."""

    def test_plain_full_scenario(self, mocker):
        """Full round-trip with PLAIN encryption and PLAIN auth."""
        mock_smtp = mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        instance = mock_smtp.return_value

        client = ClientSmtp("mail.example.com", 25, cs.SOCKET_ENC_PLAIN, "plain")
        client.connect()
        client.login("user@example.com", "mypassword")
        msg = Message()
        msg["Subject"] = "Hello"
        msg.set_payload("World")
        client.send_mail(msg)

        mock_smtp.assert_called_once_with("mail.example.com", 25)
        instance.ehlo.assert_called()
        instance.send_message.assert_called_once_with(msg)
        assert client.connected is True
        assert client.authenticated is True

    def test_implicit_tls_full_scenario(self, mocker):
        """Full round-trip with IMPLICIT TLS and XOAUTH2 auth."""
        mock_ssl = mocker.patch("smtplib.SMTP_SSL", return_value=_mock_smtp_ssl_instance())
        instance = mock_ssl.return_value

        client = ClientSmtp("mail.example.com", 465, cs.SOCKET_ENC_IMPLICIT_TLS, "xoauth2")
        client.connect()
        client.login("user@example.com", "bearer_token")

        mock_ssl.assert_called_once_with("mail.example.com", 465)
        instance.ehlo.assert_called_once()
        # Should have sent AUTH XOAUTH2
        instance.docmd.assert_called_once()
        call_args = instance.docmd.call_args[0]
        assert call_args[0] == "AUTH"
        assert "XOAUTH2" in call_args[1]
        assert client.authenticated is True

    def test_explicit_tls_full_scenario(self, mocker):
        """Full round-trip with EXPLICIT TLS and OAUTHBEARER auth."""
        mock_smtp = mocker.patch("smtplib.SMTP", return_value=_mock_smtp_instance())
        instance = mock_smtp.return_value

        client = ClientSmtp("mail.example.com", 587, cs.SOCKET_ENC_EXPLICIT_TLS, "oauthbearer")
        client.connect()
        client.login("user@example.com", "bearer_token")

        mock_smtp.assert_called_once_with("mail.example.com", 587)
        instance.starttls.assert_called_once()
        instance.docmd.assert_called_once()
        call_args = instance.docmd.call_args[0]
        assert call_args[0] == "AUTH"
        assert "OAUTHBEARER" in call_args[1]
        assert client.authenticated is True
