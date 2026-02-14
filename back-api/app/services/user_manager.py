from .user_data import UserData


class UserManager:
    def __init__(self):
        self.users = {}

    def get_user(self, user_id) -> UserData:
        if user_id not in self.users:
            self.users[user_id] = UserData(user_id)
        return self.users[user_id]