from classes import User

def create_user(name: str) -> User:
    return User("123", name)

def get_user_name(user: User) -> str:
    return user.get_display_name()
