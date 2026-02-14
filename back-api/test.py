lobals = {}
locals = {}

code = """result = 3 + 5
print('Result:', result)
"""

exec(code, globals, locals)

print(locals)