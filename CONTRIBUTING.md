# Contributing

Contributions are welcome! This is a community evaluation environment for SOGo 6.

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Make your changes
4. Verify no internal/private data leaks: `rg -n 'hrz\.uni-marburg|gitlab\.hrz|172\.25\.|vhrz[0-9]' .`
5. Commit (`git commit -m "feat: description"`)
6. Push and open a Pull Request

## Guidelines

- Keep the environment self-contained — no external service dependencies
- Use `password123` for test credentials (consistency)
- Use `example.org` for all example domains
- Sanitize any internal hostnames, IPs, or secrets before committing
- Ensure `docker compose up -d` works with just Docker and Git
