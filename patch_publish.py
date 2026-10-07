import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('scripts/publish_to_github_releases.cjs', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    '''const files = [
    'eBroAgent_Setup_GIYEONLIFT.exe',
    'eBroAgent_Setup_GIYEUN.exe',
    'eBroAgent_Setup_HANSOL.exe',
    'eBroAgent_Setup_EBRO.exe',
    'eBroAgent_Setup_DEMO.exe',
    'eBroAgent_Setup.exe'
  ];''',
    '''const files = [
    'eBroAgent_Setup.exe'
  ];'''
)

with open('scripts/publish_to_github_releases.cjs', 'w', encoding='utf-8') as f:
    f.write(text)
