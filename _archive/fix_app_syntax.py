"""
Fix the corrupted app.py file by removing broken exec() code and duplicate functions.
"""

import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and remove the broken exec() block
# It starts with "with open('app_backup.py'" and ends before "@app.route("/api/status")"

# Pattern 1: Remove the exec() garbage
pattern1 = r"with open\('app_backup\.py'.*?exec\(f\.read\(\)\.replace\(\s*'''@app\.route\(\"/api/dev/health\"\).*?exec\(f\.read\(\)\s*\)"
content = re.sub(pattern1, '', content, flags=re.DOTALL)

# Pattern 2: Remove duplicate api_dev_health functions
# Keep only the first proper one
dev_health_pattern = r'(@app\.route\("/api/dev/health"\)\s*def api_dev_health\(\):.*?)(@app\.route\("/api/dev/health"\)\s*def api_dev_health\(\):)'
content = re.sub(dev_health_pattern, r'\1', content, flags=re.DOTALL)

# Pattern 3: Remove incomplete helper functions that are duplicated
helper_pattern = r'# -+ Helper functions for health checks.*?# -+ Health check endpoint implementation'
content = re.sub(helper_pattern, '', content, flags=re.DOTALL)

# Clean up multiple blank lines
content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fix applied. Checking syntax...")

# Try to compile to check for syntax errors
try:
    compile(open('app.py', encoding='utf-8').read(), 'app.py', 'exec')
    print("SUCCESS: app.py syntax is now valid!")
except SyntaxError as e:
    print(f"FAILED: Still has syntax error: {e}")
    print(f"  Line {e.lineno}: {e.text}")
