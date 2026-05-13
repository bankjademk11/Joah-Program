with open('src/components/features/store/StoreEditPanel.jsx', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if 601 <= i <= 630: # 0-indexed, so lines 602 to 631
        continue
    new_lines.append(line)

fixed_lines = [
    "                            {selectedReasonOption === 'Other' && (\n",
    '                                <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200">\n',
    '                                    <input\n',
    '                                        type="text"\n',
    '                                        value={otherReasonText}\n',
    '                                        onChange={(e) => setOtherReasonText(e.target.value)}\n',
    "                                        placeholder={t('editPanel.otherReasonPlaceholder')}\n",
    '                                        className="w-full py-2.5 px-4 text-sm bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 rounded-xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"\n',
    '                                        autoFocus\n',
    '                                    />\n',
    '                                </div>\n',
    '                            )}\n',
    '                        </div>\n',
    '\n',
    '                        {/* Verifier (Read Only) */}\n'
]

# Insert fixed lines exactly where we skipped
# We skipped at index 601 (line 602). So we insert them after index 600 (line 601).
# Note: line 601 is "                            {/* Conditional Other Reason Input */}\n"
insertion_index = 601
for idx, line in enumerate(new_lines):
    if "{/* Conditional Other Reason Input */}" in line:
        insertion_index = idx + 1
        break

new_lines = new_lines[:insertion_index] + fixed_lines + new_lines[insertion_index:]

with open('src/components/features/store/StoreEditPanel.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed syntax errors successfully.")
