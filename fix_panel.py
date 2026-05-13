with open('src/components/features/store/StoreEditPanel.jsx', encoding='utf-8') as f:
    lines = f.readlines()

# Remove garbage lines 615-624 (0-indexed 615-623) 
# Keep everything up to line 614, then skip until line 626
# Line 614 = index 613, garbage 615-623 = index 615-623, then blank 624 = index 624, then Verifier = index 625

new_lines = []
skip_range = set(range(615, 625))  # 0-indexed, skip lines 616-625

for i, line in enumerate(lines):
    if i in skip_range:
        continue
    new_lines.append(line)

with open('src/components/features/store/StoreEditPanel.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f'Done. Total lines: {len(new_lines)}')
# Verify around the fixed area
for i, l in enumerate(new_lines[610:625], start=611):
    print(f'{i}: {l!r}')
