import re

filepath = 'src/services/db.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# find users array
start = content.find('users: User[] = [')
if start != -1:
    end = content.find('];', start)
    print(content[start:start+1000])
