const key = 'test';
const manifestString = '{{test}} and {{test}}';
const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
console.log(manifestString.replace(regex, 'value'));
