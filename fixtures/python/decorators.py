def log_calls(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@log_calls
def compute(x, y):
    return add(x, y)

def add(a, b):
    return a + b

class Calculator:
    def __init__(self, name):
        self.name = name

    def multiply(self, a, b):
        return a * b

    def compute_sum(self, a, b):
        return add(a, b)
