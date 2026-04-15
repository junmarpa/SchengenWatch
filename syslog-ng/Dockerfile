FROM alpine:3.19

# Install syslog-ng (minimal set — no extras)
RUN apk add --no-cache \
    syslog-ng \
    syslog-ng-scl \
    && rm -rf /var/cache/apk/*

# Copy configuration
COPY syslog-ng.conf /etc/syslog-ng/syslog-ng.conf

# Create socket and run directories
RUN mkdir -p /var/run/syslog-ng /var/log/perimeter /tmp/syslog-ng

EXPOSE 514/udp
EXPOSE 514/tcp
EXPOSE 601/tcp
EXPOSE 6514/tcp

CMD ["/usr/sbin/syslog-ng", "--foreground", "--no-caps"]
