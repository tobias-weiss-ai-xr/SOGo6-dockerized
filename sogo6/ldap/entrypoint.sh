#!/bin/sh
set -e

# Reduce open file limit to prevent ch_calloc assertion failure
# (OpenLDAP crashes on high ulimit-n values common in Docker)
ulimit -n 1024

LDAP_ORGANISATION="${LDAP_ORGANISATION:-Example Org}"
LDAP_DOMAIN="${LDAP_DOMAIN:-example.org}"
LDAP_BASE_DN="${LDAP_BASE_DN:-dc=example,dc=org}"
LDAP_ADMIN_PASSWORD="${LDAP_ADMIN_PASSWORD:-admin}"
LDAP_CONFIG_PASSWORD="${LDAP_CONFIG_PASSWORD:-config}"
LDAP_LOG_LEVEL="${LDAP_LOG_LEVEL:-256}"
LDAP_TLS="${LDAP_TLS:-false}"

LDAP_DC1=$(echo "$LDAP_DOMAIN" | cut -d. -f1)

if [ ! -f /var/lib/ldap/.initialized ]; then
    echo "First start - initializing LDAP database..."

    mkdir -p /var/lib/ldap /etc/ldap/slapd.d /var/run/slapd
    rm -rf /etc/ldap/slapd.d/*

    cat > /tmp/slapd.conf << CONFFOF
include /etc/ldap/schema/core.schema
include /etc/ldap/schema/cosine.schema
include /etc/ldap/schema/inetorgperson.schema
include /etc/ldap/schema/nis.schema

modulepath /usr/lib/ldap
moduleload back_mdb

database config
rootdn "cn=config"
rootpw ${LDAP_CONFIG_PASSWORD}

database mdb
suffix "${LDAP_BASE_DN}"
rootdn "cn=admin,${LDAP_BASE_DN}"
rootpw ${LDAP_ADMIN_PASSWORD}
directory /var/lib/ldap
index objectClass eq
CONFFOF

    chown -R openldap:openldap /etc/ldap/slapd.d /var/lib/ldap /var/run/slapd

    slapd -f /tmp/slapd.conf -F /etc/ldap/slapd.d -h "ldapi://%2Fvar%2Frun%2Fslapd%2Fldapi ldap:///" -u openldap -g openldap -d 0 &
    SLAPD_PID=$!
    sleep 2

    if ! kill -0 $SLAPD_PID 2>/dev/null; then
        echo "ERROR: slapd failed to start"
        exit 1
    fi

    ldapmodify -x -H ldapi://%2Fvar%2Frun%2Fslapd%2Fldapi -D cn=config -w "$LDAP_CONFIG_PASSWORD" << EOF
dn: olcDatabase={1}mdb,cn=config
changetype: modify
add: olcDbIndex
olcDbIndex: uid eq
-
add: olcDbIndex
olcDbIndex: mail eq
EOF

    cat > /tmp/base.ldif << EOF
dn: ${LDAP_BASE_DN}
objectClass: dcObject
objectClass: organization
dc: ${LDAP_DC1}
o: ${LDAP_ORGANISATION}
EOF
    ldapadd -x -H ldapi://%2Fvar%2Frun%2Fslapd%2Fldapi -D "cn=admin,${LDAP_BASE_DN}" -w "$LDAP_ADMIN_PASSWORD" -f /tmp/base.ldif

    if [ -n "$LDAP_SEED_INTERNAL_LDIF_PATH" ] && [ -d "$LDAP_SEED_INTERNAL_LDIF_PATH" ]; then
        for f in $(find "$LDAP_SEED_INTERNAL_LDIF_PATH" -name '*.ldif' | sort); do
            echo "Loading seed LDIF: $f"
            tmpf=$(mktemp)
            sed "s/{{ LDAP_BASE_DN }}/${LDAP_BASE_DN}/g" "$f" | sed "s/{{ LDAP_DOMAIN }}/${LDAP_DOMAIN}/g" > "$tmpf"
            if grep -q "^changetype:" "$tmpf"; then
                ldapmodify -x -H ldapi://%2Fvar%2Frun%2Fslapd%2Fldapi -D cn=config -w "$LDAP_CONFIG_PASSWORD" -f "$tmpf"
            else
                ldapadd -x -H ldapi://%2Fvar%2Frun%2Fslapd%2Fldapi -D "cn=admin,${LDAP_BASE_DN}" -w "$LDAP_ADMIN_PASSWORD" -f "$tmpf"
            fi
            rm -f "$tmpf"
        done
    fi

    kill $SLAPD_PID
    wait $SLAPD_PID || true
    touch /var/lib/ldap/.initialized
    echo "LDAP initialization complete"
fi

mkdir -p /var/run/slapd
chown openldap:openldap /var/run/slapd

exec slapd -F /etc/ldap/slapd.d -h "ldap:/// ldapi://%2Fvar%2Frun%2Fslapd%2Fldapi" -u openldap -g openldap -d "$LDAP_LOG_LEVEL"
