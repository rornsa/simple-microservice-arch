#!/bin/bash
# Generate code using buf
bun x @bufbuild/buf generate

# Fix Python imports in proto_gen directories
python3 -c '
import os
import re

# Find all proto_gen directories under api/services/
services_dir = "api/services"
proto_gen_dirs = []

if os.path.exists(services_dir):
    for root, dirs, files in os.walk(services_dir):
        if "proto_gen" in dirs:
            proto_gen_dirs.append(os.path.join(root, "proto_gen"))

for path in proto_gen_dirs:
    # Only process if it contains Python files (indicates a Python project)
    has_python_files = any(f.endswith(".py") for f in os.listdir(path))
    if not has_python_files:
        continue

    print(f"Processing {path}...")
    
    # Ensure __init__.py exists
    init_file = os.path.join(path, "__init__.py")
    if not os.path.exists(init_file):
        with open(init_file, "w") as f:
            pass
        print(f"Created {init_file}")

    for filename in os.listdir(path):
        if filename.endswith(".py") and filename != "__init__.py":
            filepath = os.path.join(path, filename)
            with open(filepath, "r") as f:
                content = f.read()
            
            # Replace "import X_pb2 as Y" with "from . import X_pb2 as Y"
            # This handles both standard protoc and connectrpc-python output
            new_content = re.sub(r"^import (.*_pb2) as (.*)$", r"from . import \1 as \2", content, flags=re.MULTILINE)
            # Also handle "import X_pb2" without alias
            new_content = re.sub(r"^import (.*_pb2)$", r"from . import \1", new_content, flags=re.MULTILINE)
            
            if content != new_content:
                with open(filepath, "w") as f:
                    f.write(new_content)
                print(f"Fixed imports in {filepath}")
'
