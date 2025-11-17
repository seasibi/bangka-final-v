#!/usr/bin/env python3
"""
Fix indentation in views.py:
1. Add 4 spaces to lines 3545-3620 (boundary crossing section)
2. Remove duplicate/broken code at lines 3571-3590
"""

file_path = r'c:\Users\rhyi\OneDrive\Documents\GitHub\bangka-final-v\backend\api\views.py'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines in file: {len(lines)}")
print(f"\nLine 3544 (index 3543): {repr(lines[3543])}")
print(f"Line 3545 (index 3544): {repr(lines[3544])}")

# Find the section to fix (looking for the boundary crossing section)
# It starts at line 3545 (index 3544) with "    if filter_type in ['all', 'movements']:"

# Strategy:
# 1. Find line 3545 and verify it's the boundary crossing start
# 2. Add 4 spaces to lines from 3545 onwards until we hit the violations section
# 3. Remove the duplicate section that starts around line 3571

new_lines = []
i = 0
skip_until = -1

while i < len(lines):
    # Skip lines that are part of the duplicate section (lines 3571-3590, indices 3570-3589)
    if 3570 <= i <= 3590:
        line = lines[i].rstrip()
        # Check if this is the orphaned ")" or duplicate "if persisted_crossings:"
        if line.strip() == ')' or (line.strip().startswith('if persisted_crossings:') and i > 3552):
            # Skip this line and the duplicate block
            if skip_until < 0:
                skip_until = 3591  # Skip until after the duplicate
            i += 1
            continue
    
    # If we're in skip mode, skip until we reach the target line
    if skip_until >= 0 and i < skip_until:
        i += 1
        continue
    else:
        skip_until = -1
    
    # Add 4 spaces to the boundary crossing section (lines 3545-3620, indices 3544-3619)
    # But only if it's part of the movements section, not the violations
    if 3544 <= i < 3620:
        line = lines[i]
        # Check if this is the start of violations section
        if '# 4) Violations' in line or 'if filter_type in [\'all\', \'violations\']' in line:
            # Stop adding spaces, we've reached violations
            new_lines.append(line)
        else:
            # Add 4 spaces to indent inside try block
            new_lines.append('    ' + line)
    else:
        new_lines.append(lines[i])
    
    i += 1

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"\n✅ Fixed! New total lines: {len(new_lines)}")
print(f"Removed approximately {len(lines) - len(new_lines)} duplicate lines")
print(f"\nNew line 3545 (index 3544): {repr(new_lines[3544])}")
