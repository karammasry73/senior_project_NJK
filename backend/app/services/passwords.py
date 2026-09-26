"""Password hashing - standalone on purpose (no app imports) so both
database.py (seeding the default admin) and auth.py (verifying logins)
can use it without creating a circular import between the two."""

import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
