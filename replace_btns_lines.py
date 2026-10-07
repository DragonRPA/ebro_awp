filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = 1736
end_idx = 1763 # non-inclusive

new_buttons = """                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      onClick={() => handleOpenEditSite(cs)}
                                      style={{ padding: '1px 5px', fontSize: '10.5px' }}
                                    >
                                      수정
                                    </button>\n"""

lines[start_idx:end_idx] = [new_buttons]

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Buttons updated!")
