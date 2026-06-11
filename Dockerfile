# ---- Build stage: compile the WAR ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn -B -q -DskipTests package

# ---- Runtime stage: Tomcat + mysql client (for first-run DB init) ----
FROM tomcat:10.1-jdk21
RUN apt-get update \
    && apt-get install -y --no-install-recommends default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

RUN rm -rf /usr/local/tomcat/webapps/*
COPY --from=build /build/target/metrolink-backend.war /usr/local/tomcat/webapps/metrolink-backend.war
COPY frontend /usr/local/tomcat/webapps/metrolink-frontend
COPY src/main/resources/schema.sql /db-init/schema.sql
COPY src/main/resources/demo-seed.sql /db-init/demo-seed.sql
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
