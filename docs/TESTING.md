# SOGo 6 Testing Guide

## Introduction

This guide covers all aspects of testing in the SOGo 6 development environment.

## Test Types

| Type | When to Use | Location | Command |
|------|-------------|----------|---------|
| Unit | Individual function testing | `tests/unit/` | `pytest tests/unit/ -v` |
| Integration | Multi-component testing | `tests/integration/` | `pytest tests/integration/ -v` |
| API | REST API testing | `tests/api/` | `bash tests/api-test.sh` |
| E2E | End-to-End browser testing | `tests/e2e/` | `bash tests/sogo6-e2e-test.js` |
| Smoke | Quick verification | `tests/` | `make test-smoke` |
| Security | Security scanning | `tests/` | `bash tests/security-test.sh` |
| Performance | Load testing | `tests/` | `bash tests/concurrent-test.sh` |

## Test Structure

```
tests/
├── unit/              # Unit tests (mocked dependencies)
│   ├── test_models.py
│   ├── test_utils.py
│   └── test_services.py
├── integration/       # Integration tests (real dependencies)
│   ├── test_api_integration.py
│   ├── test_ldap_integration.py
│   └── test_email_integration.py
├── api/               # API-specific tests
│   ├── test_users.py
│   ├── test_messages.py
│   └── ...
├── e2e/               # End-to-end tests
│   └── sogo6-e2e-test.js
├── fixtures/          # Test data
│   ├── users.json
│   └── messages.json
├── conftest.py        # Pytest fixtures
├── api-test.sh        # Shell-based API tests
├── ldap-test.sh       # LDAP verification
├── smtp-test.sh       # Email testing
├── mariadb-test.sh   # Database testing
├── redis-test.sh      # Redis testing
├── nginx-test.sh      # Nginx testing
├── security-test.sh   # Security scanning
├── concurrent-test.sh # Performance testing
├── integration-test.sh # Integration test runner
└── run-all-tests.sh   # Full test suite
```

## Quick Start

### Run All Tests

```bash
# Using make
make test

# Or directly
bash tests/run-all-tests.sh
```

### Run in Dev Environment

```bash
# Start dev stack first
make start-dev

# Run tests inside dev containers
make test-dev

# Watch mode (auto-reload on changes)
make test-watch
```

## Unit Testing

### Python Unit Tests

**Framework:** pytest with pytest-asyncio

```python
# tests/unit/test_utils.py
import pytest
from sogo6.utils import format_email


class TestFormatEmail:
    def test_simple_email(self):
        assert format_email("john", "example.com") == "john@example.com"

    def test_email_with_subdomain(self):
        assert format_email("jane", "mail.example.com") == "jane@mail.example.com"

    def test_empty_local_part(self):
        assert format_email("", "example.com") == "@example.com"
```

**Running:**
```bash
# Run all unit tests
pytest tests/unit/ -v

# Run specific test
pytest tests/unit/test_utils.py::TestFormatEmail::test_simple_email -v

# Run with coverage
pytest tests/unit/ --cov=sogo6 --cov-report=html
```

### Mocking Dependencies

```python
from unittest.mock import patch, MagicMock
import pytest


def test_db_connection():
    with patch('sogo6.db.connect') as mock_connect:
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        
        # Test code that uses db.connect
        result = import_data()
        
        mock_connect.assert_called_once()
        assert result == expected


# Using pytest-mock fixture
class TestAPI:
    def test_list_users(self, mocker):
        mock_get = mocker.patch('requests.get')
        mock_get.return_value.json.return_value = {'users': []}
        
        result = get_users()
        assert result == []
```

## Integration Testing

### Database Integration

```python
# tests/integration/test_database.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def db_session():
    """Create a test database session."""
    engine = create_engine('mariadbql://sogo:sogo@sogo6-mariadb:5432/sogo_test')
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Setup test data
    from sogo6.models import User
    session.add(User(email='test@integration.com'))
    session.commit()
    
    yield session
    
    # Cleanup
    session.query(User).delete()
    session.commit()
    session.close()


def test_user_creation(db_session):
    from sogo6.models import User
    
    user = User(email='new@test.com')
    db_session.add(user)
    db_session.commit()
    
    retrieved = db_session.query(User).filter_by(email='new@test.com').first()
    assert retrieved is not None
```

**Running:**
```bash
pytest tests/integration/ -v
```

## API Testing

### Shell-based Tests

```bash
# Run API tests
bash tests/api-test.sh

# Specific test
bash tests/api-test.sh test_get_system_info
```

**Custom API Test:**
```bash
#!/bin/bash
set -e

BASE_URL="http://localhost:5001/api/user/v1"

# Test system info endpoint
echo "Testing GET /system..."
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/system")
code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$code" != "200" ]; then
    echo "FAIL: Expected 200, got $code"
    echo "$body"
    exit 1
fi

echo "PASS: System info returned"
```

### Python API Tests

**Using requests library:**
```python
# tests/api/test_users.py
import pytest
import requests


@pytest.fixture
def api_client():
    """Create a test API client."""
    return requests.Session()


@pytest.fixture
def auth_token(api_client):
    """Get authentication token."""
    response = api_client.post(
        'http://localhost:5001/api/user/v1/auth/login',
        json={'email': 'test@test.com', 'password': 'password123'}
    )
    return response.json()['token']


def test_create_user(api_client, auth_token):
    headers = {'Authorization': f'Bearer {auth_token}'}
    response = api_client.post(
        'http://localhost:5001/api/user/v1/users',
        json={'email': 'new@test.com', 'name': 'New User'},
        headers=headers
    )
    
    assert response.status_code == 201
    assert response.json()['email'] == 'new@test.com'
```

**Using httpx (async):**
```python
import pytest
import httpx


@pytest.mark.asyncio
async def test_health_check():
    async with httpx.AsyncClient() as client:
        response = await client.get('http://localhost:5001/api/user/v1/system')
        assert response.status_code == 200
```

## End-to-End Testing

### Playwright Tests

**Install:**
```bash
npm install -D @playwright/test
npx playwright install
```

**Test Example:**
```javascript
// tests/e2e/test_login.js
const { test, expect } = require('@playwright/test');

test('user can login', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  
  await page.fill('input[name="email"]', 'testuser@example.org');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('http://localhost:3000/dashboard');
  await expect(page.locator('.welcome')).toHaveText('Welcome!');
});
```

**Running:**
```bash
npx playwright test
npx playwright test --ui  # Test UI mode
npx playwright test --headed  # Show browser
npx playwright show-report  # Show report
```

### Cypress Tests

**Alternative to Playwright:**
```javascript
// cypress/integration/login.spec.js
describe('Login', () => {
  it('user can login', () => {
    cy.visit('http://localhost:3000/login');
    cy.get('input[name="email"]').type('testuser@example.org');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

## Test Data Management

### Fixtures

```python
# tests/fixtures/users.py
import pytest
from sogo6.models import User


@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    user = User(
        email='test@example.com',
        password='password123',
        name='Test User'
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def multiple_users(db_session):
    """Create multiple test users."""
    users = []
    for i in range(10):
        user = User(
            email=f'test{i}@example.com',
            password='password123'
        )
        db_session.add(user)
        users.append(user)
    db_session.commit()
    return users
```

### Factory Boy

```python
# tests/factories.py
import factory
from sogo6.models import User


class UserFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = User
        sqlalchemy_session = db_session
    
    email = factory.Faker('email')
    password = 'password123'
    name = factory.Faker('name')


# Usage in tests
user = UserFactory()
users = UserFactory.create_batch(10)
```

## Testing LDAP

```bash
# Quick LDAP test
bash tests/ldap-test.sh
```

**Python LDAP Test:**
```python
import ldap3


def test_ldap_connection():
    server = ldap3.Server('sogo6-ldap', port=389)
    conn = ldap3.Connection(server, 'cn=admin,dc=example,dc=org', 'admin')
    
    assert conn.bind()
    
    conn.search('dc=example,dc=org', '(objectClass=*)')
    assert len(conn.entries) > 0
```

## Testing SMTP

```bash
# Quick SMTP test
bash tests/smtp-test.sh
```

**Python SMTP Test:**
```python
import smtplib


def test_smtp_connection():
    with smtplib.SMTP('sogo6-stalwart', port=20025) as server:
        server.ehlo()
        # Continue with login if needed
```

## Testing Redis

```bash
# Quick Redis test
bash tests/redis-test.sh
```

**Python Redis Test:**
```python
import redis


def test_redis_connection():
    r = redis.Redis(host='sogo6-redis', port=6379, db=0)
    
    r.set('test_key', 'test_value')
    assert r.get('test_key') == b'test_value'
```

## Testing MariaDB

```bash
# Quick MariaDB test
bash tests/mariadb-test.sh
```

**Python MariaDB Test:**
```python
import psycopg2


def test_mariadb_connection():
    conn = psycopg2.connect(
        host='sogo6-mariadb',
        database='sogo',
        user='sogo',
        password='sogo'
    )
    
    cursor = conn.cursor()
    cursor.execute('SELECT 1')
    assert cursor.fetchone()[0] == 1
```

## Performance Testing

### Locust Load Testing

**Install:**
```bash
pip install locust
```

**Locustfile:**
```python
# locustfile.py
from locust import HttpUser, task, between


class WebsiteUser(HttpUser):
    wait_time = between(1, 5)

    @task
    def view_system_info(self):
        self.client.get('/api/user/v1/system')

    @task(3)
    def view_users(self):
        self.client.get('/api/user/v1/users', headers={'Authorization': 'Bearer token'})

    def on_start(self):
        # Login
        response = self.client.post('/api/user/v1/auth/login', json={
            'email': 'test@test.com',
            'password': 'password123'
        })
        self.token = response.json()['token']
```

**Running:**
```bash
locust -f locustfile.py --host=http://localhost:5001
# Open http://localhost:8089
```

### Concurrent Testing

```bash
# Run the concurrent test script
bash tests/concurrent-test.sh
```

**Custom Concurrent Test:**
```python
import asyncio
import aiohttp
import time


async def make_request(session, url):
    async with session.get(url) as response:
        return await response.text()


async def test_concurrent_requests():
    url = 'http://localhost:5001/api/user/v1/system'
    
    async with aiohttp.ClientSession() as session:
        tasks = [make_request(session, url) for _ in range(100)]
        responses = await asyncio.gather(*tasks)
        
        assert len(responses) == 100
        assert all('SOGo' in r for r in responses)


if __name__ == '__main__':
    start = time.time()
    asyncio.run(test_concurrent_requests())
    print(f'100 requests completed in {time.time() - start:.2f}s')
```

## Security Testing

### Run Security Tests

```bash
bash tests/security-test.sh
```

**Custom Security Test:**
```python
import requests


def test_sql_injection():
    """Test for SQL injection vulnerabilities."""
    # This is a NEVER EXECUTE type test - just checking if the system is vulnerable
    # Always use safe parameterized queries
    
    # Test that suspicious input is handled safely
    response = requests.get('http://localhost:5001/api/user/v1/users?q=test%27+OR+1=1')
    
    # Should not cause a database error
    assert response.status_code in [200, 400, 401, 403, 404]
    
    # If 500, there might be a SQL injection vulnerability
    # This test SHOULD NOT return a 500 error
    assert response.status_code != 500
```

## Test Configuration

### pytest.ini

```ini
[pytest]
minversion = 7.0
addopts = -ra --strict-markers --strict-config
 markers = 
     slow: marks tests as slow (deselect with '-m "not slow"')
     integration: marks tests as integration (integration tests)
     unit: marks tests as unit tests
     api: marks tests as API tests

testpaths = 
    tests/unit
    tests/integration
    tests/api

python_files = test_*.py
python_classes = Test*
python_functions = test_*

log_cli = true
log_cli_level = INFO

# Coverage settings
[coverage:run]
source = sogo6
omit = */__pycache__/* */tests/*

[coverage:report]
exclude_lines = 
    pragma: no cover
    def __repr__
    raise NotImplementedError
    if TYPE_CHECKING:
    @abstractmethod

[coverage:html]
directory = htmlcov
```

### conftest.py (Pytest Fixtures)

```python
# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


# Fixture for database session
@pytest.fixture(scope='session')
def engine():
    return create_engine('mariadbql://sogo:sogo@sogo6-mariadb:5432/sogo_test')


@pytest.fixture
def db_session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


# Fixture for API client
@pytest.fixture
def api_client():
    import requests
    return requests.Session()


# Fixture for auth
@pytest.fixture
def auth_token(api_client):
    response = api_client.post(
        'http://localhost:5001/api/user/v1/auth/login',
        json={'email': 'testuser@example.org', 'password': 'password123'}
    )
    return response.json()['token']


# Fixture for test data setup
def setup_test_data(db_session):
    """Setup common test data."""
    from sogo6.models import User, Domain
    
    domain = Domain(name='example.org')
    db_session.add(domain)
    
    user = User(
        email='test@example.org',
        password='password123',
        domain=domain
    )
    db_session.add(user)
    db_session.commit()
    
    return domain, user
```

## Test Execution Options

### Run Specific Tests

```bash
# Run by marker
pytest -m unit
pytest -m integration
pytest -m "not slow"  # Skip slow tests

# Run by keyword
pytest -k "login"
pytest -k "not api"  # Exclude api tests

# Run by path
pytest tests/unit/test_models.py

# Run by test name
pytest tests/unit/test_models.py::TestUser::test_creation
```

### Parallel Testing

```bash
# Install pytest-xdist
pip install pytest-xdist

# Run tests in parallel
pytest -n 4  # Use 4 workers
pytest -n auto  # Auto-detect number of CPUs

# Numprocess option
pytest -n 4 --dist=loadfile  # Distribute by file
pytest -n 4 --dist=loadscope  # Distribute by module
```

### Coverage

```bash
# Test with coverage
pytest --cov=sogo6 --cov-report=html

# Minimum coverage
pytest --cov=sogo6 --cov-fail-under=80

# Combined coverage report
coverage combine
coverage report
coverage html
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mariadb:
        image: mariadb:15-alpine
        env:
          POSTGRES_USER: sogo
          POSTGRES_PASSWORD: sogo
          POSTGRES_DB: sogo_test
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-dev.txt
    
    - name: Run unit tests
      run: pytest tests/unit/ -v --cov=sogo6 --cov-report=xml
    
    - name: Run integration tests
      run: pytest tests/integration/ -v
      env:
        SOGO_DB_URI: mariadbql://sogo:sogo@localhost:5432/sogo_test
        SOGO_REDIS_URI: redis://localhost:6379/0
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## Best Practices

### 1. Test Naming

```python
# Good
def test_user_creation_with_valid_email():
    ...

# Bad
def test_it():
    ...
```

### 2. Test Isolation

```python
# Each test should be independent
def test_create_user(db_session):
    # Setup
    user = User(email='test1@test.com')
    db_session.add(user)
    db_session.commit()
    
    # Test
    retrieved = db_session.query(User).filter_by(email='test1@test.com').first()
    assert retrieved.email == 'test1@test.com'
    
    # Cleanup (handled by fixture)
```

### 3. Arrange-Act-Assert Pattern

```python
# Arrange
test_data = {'email': 'test@test.com'}

# Act
response = client.post('/api/users', json=test_data)

# Assert
assert response.status_code == 201
assert response.json()['email'] == 'test@test.com'
```

### 4. Don't Test Implementation Details

```python
# Bad - tests implementation
def test_user_has_method():
    user = User()
    assert hasattr(user, 'validate_email')  # Tests implementation

# Good - tests behavior
def test_user_creation_with_invalid_email():
    with pytest.raises(ValidationError):
        User(email='invalid-email')  # Tests behavior
```

### 5. Use Factories or Fixtures for Test Data

```python
# Good
def test_with_factory():
    user = UserFactory()
    assert user.email  # Always has valid data

# Bad
def test_with_hardcoded():
    user = User(email='test@test.com', name='Test User', ...)  # Hard to maintain
```

### 6. Test Edge Cases

```python
def test_user_creation():
    # Test valid input
    assert create_user('valid@test.com')
    
    # Test invalid input
    with pytest.raises(ValidationError):
        create_user('invalid-email')
    
    with pytest.raises(ValidationError):
        create_user('@test.com')  # Empty local part
    
    with pytest.raises(ValidationError):
        create_user('a' * 255 + '@test.com')  # Too long
```

### 7. Use Parameterized Tests

```python
@pytest.mark.parametrize('email,expected', [
    ('valid@test.com', True),
    ('invalid-email', False),
    ('@test.com', False),
])
def test_email_validation(email, expected):
    assert is_valid_email(email) == expected
```

### 8. Mock External Services

```python
# Good - mock external API
def test_payment_processing(mocker):
    mocker.patch('external_api.charge', return_value={'status': 'success'})
    result = process_payment('card123', 100)
    assert result['status'] == 'success'

# Bad - hits real API (slow, unreliable, may have side effects)
def test_payment_processing():
    result = process_payment('real-card', 100)  # Don't do this!
    assert result['status'] == 'success'
```

### 9. Test Performance

```python
import time

@pytest.mark.slow
def test_performance():
    start = time.time()
    result = expensive_operation()
    duration = time.time() - start
    assert duration < 1.0  # Less than 1 second
    assert result == expected
```

### 10. Clean Up After Tests

```python
# Use fixtures for automatic cleanup
@pytest.fixture
def temp_file():
    import tempfile
    file = tempfile.NamedTemporaryFileMode('w+')
    yield file
    file.close()  # Automatic cleanup

# Or use pytest's tmp_path fixture
@pytest.fixture
def tmp_dir(tmp_path):
    file = tmp_path / 'test.txt'
    file.write_text('test')
    return file
```

## Troubleshooting

### 1. Tests Pass Locally but Fail in CI

- **Solution:** Check environment variables, database setup, service dependencies
- Use `pytest --dotenv` for environment files

### 2. Database Tests Fail

- **Solution:** Ensure database is running and migrated
- Check connection string
- Reset database between tests

### 3. Tests Are Slow

- **Solution:** Use `pytest.mark.slow` and run with `-m "not slow"`
- Mock external services
- Use smaller test datasets

### 4. Test Order Dependencies

- **Solution:** Ensure each test is isolated
- Use fixtures for setup/teardown
- Run with random order: `pytest --random-order`

### 5. Flaky Tests

- **Solution:** Add retries with `pytest-rerunfailures`
- Investigate the root cause
- Fix timing issues

### 6. Coverage Issues

- **Solution:** Check if tests actually run the code
- Look for "pragma: no cover" comments
- Add missing tests

## Useful pytest Plugins

```bash
# Install
pip install pytest-cov pytest-django pytest-asyncio pytest-mock pytest-xdist
pip install pytest-random-order pytest-rerunfailures pytest-freezegun
pip install pytest-benchmark pytest-profiling pytest-timeout
```

| Plugin | Purpose |
|--------|---------|
| pytest-cov | Coverage reporting |
| pytest-django | Django integration |
| pytest-asyncio | Async test support |
| pytest-mock | Mock fixture |
| pytest-xdist | Parallel test execution |
| pytest-random-order | Random test order |
| pytest-rerunfailures | Retry flaky tests |
| pytest-freezegun | Freeze time for tests |
| pytest-benchmark | Performance benchmarking |
| pytest-profiling | Profile test execution |
| pytest-timeout | Set test timeouts |
