# Contributing to German Law Vault

Thank you for your interest in contributing to German Law Vault! This guide will help you get started.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [How to Contribute](#how-to-contribute)
4. [Development Guidelines](#development-guidelines)
5. [Pull Request Process](#pull-request-process)
6. [Coding Standards](#coding-standards)

---

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Keep discussions professional and on-topic

---

## Getting Started

### 1. Fork the Repository

```bash
# Click "Fork" on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/german-law-vault.git
cd german-law-vault
```

### 2. Set Up Development Environment

```bash
# Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # macOS/Linux

# Install dependencies + dev tools
pip install -r requirements.txt
pip install black flake8 pytest pytest-flask
```

### 3. Create a Branch

```bash
# Always branch from main
git checkout main
git checkout -b feature/your-feature-name
```

---

## How to Contribute

### Ways to Contribute

| Type | Description |
|------|-------------|
| **Bug Reports** | Open an issue with detailed steps to reproduce |
| **Feature Requests** | Suggest improvements or new features |
| **Documentation** | Fix typos, improve guides, add examples |
| **Code** | Fix bugs, implement features, optimize performance |
| **Testing** | Write tests, verify fixes, test edge cases |
| **Translations** | Improve German-English legal dictionary |

### Good First Issues

Look for issues labeled:
- `good first issue` - Beginner-friendly tasks
- `help wanted` - Need community help
- `bug` - Something needs fixing
- `enhancement` - New feature requests

---

## Development Guidelines

### Making Changes

1. **Understand the codebase** - Read [DOCUMENTATION.md](DOCUMENTATION.md)
2. **Make small, focused changes** - One feature/fix per PR
3. **Write tests** - Ensure your changes work correctly
4. **Update documentation** - Keep docs in sync with code
5. **Test locally** - Verify everything works before submitting

### Testing Your Changes

```bash
# Run all tests
cd tests
python run_all_tests.py

# Run specific test file
python test_dict_lookup.py

# Run with pytest
pytest tests/ -v

# Test the application manually
python app.py
# Open http://localhost:5000 and test features
```

### Code Quality

```bash
# Format code with Black
black .

# Lint with Flake8
flake8 .

# Check for common issues
python -m py_compile *.py
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines (Black formatted)
- [ ] All tests pass
- [ ] No new linting errors
- [ ] Documentation updated
- [ ] Commit messages are clear and descriptive

### Creating a Pull Request

1. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

2. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open Pull Request on GitHub**
   - Go to your fork on GitHub
   - Click "Pull requests" → "New pull request"
   - Select your branch
   - Fill out the PR template

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Related Issues
Closes #123

## Testing
Describe how you tested the changes

## Checklist
- [ ] Code follows project guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No breaking changes
```

### Review Process

1. **Automated Checks** - CI runs tests and linting
2. **Maintainer Review** - Code review by project maintainers
3. **Feedback** - Address any comments or requested changes
4. **Approval** - PR is approved and merged

---

## Coding Standards

### Python Style

- **Formatter**: Black (line length: 100)
- **Linter**: Flake8
- **Imports**: Alphabetical, standard library first
- **Docstrings**: Google style

```python
# Example function with proper docstring
def expand_query(query: str) -> tuple:
    """
    Translate English query to German and expand synonyms.

    Args:
        query: The search query string

    Returns:
        Tuple of (original_tokens, german_terms)

    Example:
        >>> expand_query("tenant rights")
        (['tenant', 'rights'], ['Mieter', 'Rechte'])
    """
    pass
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | snake_case | `search_query` |
| Functions | snake_case | `build_index()` |
| Classes | PascalCase | `SearchIndex` |
| Constants | UPPER_SNAKE_CASE | `MAX_RESULTS` |
| Private | leading underscore | `_internal_method()` |

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code changes)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(search): add fuzzy matching for German terms

- Implement Levenshtein distance matching
- Add configuration for similarity threshold

Closes #456
```

```
fix(api): correct pagination offset calculation

The offset was calculated as page * per_page instead of
(page - 1) * per_page, causing first page to skip results.
```

---

## Areas Needing Contribution

### High Priority

1. **Test Coverage** - More unit and integration tests
2. **Performance** - Optimize search and indexing
3. **Accessibility** - Improve UI accessibility
4. **Documentation** - More examples and tutorials

### Medium Priority

1. **Internationalization** - Support more languages
2. **API Improvements** - Better error messages, more endpoints
3. **Frontend** - Modern UI improvements
4. **Data Quality** - Better XML parsing edge cases

### Nice to Have

1. **Export Features** - PDF/CSV export of laws
2. **Bookmarks** - User bookmark system
3. **History** - Search history tracking
4. **Mobile** - Better mobile responsiveness

---

## Questions?

- **General Questions**: Open a GitHub Discussion
- **Bug Reports**: Open an Issue
- **Chat**: Check if there's a community chat channel

---

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

---

**Thank you for contributing to German Law Vault! ⚖️**
