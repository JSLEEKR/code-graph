from simple import greet

class User:
    def __init__(self, user_id: str, name: str):
        self.id = user_id
        self.name = name

    def get_display_name(self) -> str:
        return self.name.upper()

    def greet_user(self) -> str:
        return greet(self.name)
