FROM debian:bookworm-slim

RUN apt-get update -qq && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
        slapd \
        ldap-utils \
        openssl \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/lib/ldap /etc/ldap/slapd.d /var/run/slapd /ldif-seed && \
    chown -R openldap:openldap /var/lib/ldap /etc/ldap/slapd.d /var/run/slapd

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

VOLUME ["/var/lib/ldap", "/etc/ldap/slapd.d", "/ldif-seed"]

EXPOSE 389 636

ENTRYPOINT ["/entrypoint.sh"]
