from PIL import Image
import os

img = Image.open('agent/eBroAgent.png')
img.save('agent/eBroAgent.ico', format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print('Successfully recreated eBroAgent.ico from eBroAgent.png')
