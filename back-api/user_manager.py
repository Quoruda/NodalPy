from userData import UserData


class UserManager:
    def __init__(self):
        self.users = {}

    def get_user(self, user_id) -> UserData:
        return self.users.get(user_id, UserData(user_id))