# Dev Branch: Gaps, Issues, and Improvements

## Known Issues

### 🚨 Critical - Must Fix

1. **sogo6-ui and sogo6-server directories are gitignored**
   - The main compose file references these directories which are in .gitignore
   - Workaround: `make setup` deve clone repos, but docker-compose.dev.yaml won't see them
   - Fix: Update .gitignore to allow sogo6-ui/ and sogo6-server/ directories

2. **Missing secrets/sogo6.vault.env**
   - docker-compose.dev.yaml references this file which may not exist
   - Fix: Optional env_file or provide default values

3. **Dockerfile.local vs existing Dockerfile**
   - The dev compose expects deploy/local/Dockerfile.local with `development` target
   - May conflict with actual project Dockerfiles

### ⚠️ Warnings

4. **LDAP tools may not work correctly**
   - LDAP Admin (osixia/openldap:1.5.0) may have connectivity issues
   - phpLDAPadmin needs proper LDAP server config
   - Ladon may need additional configuration

5. **Monitoring not fully configured**
   - Prometheus needs service discovery or static config for all services
   - Grafana dashboards not pre-configured
   - Missing cAdvisor/Node Exporter for host metrics

6. **Hot reload may not work**
   - Volume mounts may not work correctly with gitignored directories
   - Flask reload may need WATCHED_FILES config

### 📝 Missing Documentation

7. **No debugging guide**
   - How to debug Flask with VS Code
   - How to debug React app
   - How to use debugpy port 5678

8. **No testing guide**
   - Running unit tests vs integration tests
   - Test data setup for dev environment
   - Mocking services for unit tests

9. **No contribution guide**
   - How to submit PRs
   - Coding standards
   - Review process

## Recommended Improvements

### High Priority

10. **Add a dev override file**
    ```yaml
    # docker-compose.override.yml
    # Automatically used when dev branch is active
    # Extends docker-compose.yaml with dev settings
    ```

11. **Create pre-commit hooks**
    - ruff formatting
    - mypy type checking
    - ESLint for React

12. **Add CI/CD for dev branch**
    - GitHub Actions for dev branch
    - Separate dev deployment pipeline

### Medium Priority

13. **Enhanced monitoring**
    - Add cAdvisor for container metrics
    - Add Node Exporter for host metrics
    - Pre-configure Grafana dashboards
    - Add alerting rules

14. **Better debugging support**
    - Configure VS Code launch.json
    - Add .vscode/ directory with dev configurations
    - Add Chrome debug port for React

15. **Improved LDAP tools**
    - LDAP browser web UI
    - Schema editor
    - Data import/export tools

16. **API development tools**
    - Swagger/OpenAPI UI
    - Postman collection
    - API documentation generator

### Low Priority

17. **Development database seed**
    - Sample data for testing
    - Easy reset commands
    - Multiple seed datasets

18. **Local development without Docker**
    - Native development setup guide
    - Local MariaDB/Redis install instructions

19. **Performance optimization**
    - Docker layer caching
    - Build optimization
    - Resource usage monitoring

20. **Team collaboration tools**
    - Shared dev environment setup
    - Pair programming configurations
    - Code review checklist

## Architecture Improvements

### Current Issues
- All tools run in separate containers → resource intensive
- No centralized logging
- No service mesh or discovery
- Monitoring is basic

### Proposed Improvements

21. **Add Traefik/Proxy**
    - Single entry point for all dev services
    - Automatic HTTPS
    - Dashboard for all services

22. **Centralized Logging**
    - Add ELK stack (Elasticsearch, Logstash, Kibana)
    - Or Loki + Promtail + Grafana
    - Correlate logs across services

23. **Service Discovery**
    - Add Consul or etcd
    - Dynamic service registration
    - Health checking

24. **Container Orchestration**
    - Consider Kubernetes for complex dev environments
    - Helm charts for dev deployment
    - Skaffold for Kubernetes development

## Documentation Improvements

### Missing Files
25. **DEBUGGING.md** - Step-by-step debugging guides
26. **TESTING.md** - Testing strategies and examples
27. **CONTRIBUTING.md** - How to contribute (exists but may need updating)
28. **ARCHITECTURE.md** - System architecture overview
29. **API.md** - API documentation

### Documentation Issues
- DEVELOPMENT.md could be more detailed
- No examples for common development tasks
- Missing troubleshooting section

## Fix Recommendations

### Immediate Fixes (Do Now)
1. Fix secrets reference → Use optional env_file
2. Fix Dockerfile paths → Ensure they exist and work
3. Fix gitignore → Allow dev-specific files
4. Add .dockerignore → Optimize builds

### Short-term Fixes (Next)
5. Add dev override file → Better dev/prod separation
6. Fix LDAP tools → Ensure they connect correctly
7. Add .vscode/ config → Better IDE support
8. Add pre-commit hooks → Better code quality

### Long-term Improvements (Later)
9. Add full monitoring → Prometheus + Grafana + cAdvisor
10. Add centralized logging → ELK or Loki
11. Add debugging guides → VS Code, PyCharm configs
12. Add testing guides → Unit, integration, e2e
