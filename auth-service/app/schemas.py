from pydantic import BaseModel, ConfigDict, Field, field_validator


def _fits_bcrypt(value: str) -> str:
    # bcrypt ne prend en compte que les 72 premiers octets
    if len(value.encode()) > 72:
        raise ValueError("Mot de passe trop long (72 octets max)")
    return value


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=6)

    _check_password = field_validator("password")(_fits_bcrypt)


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)

    _check_password = field_validator("new_password")(_fits_bcrypt)


class PasswordConfirmIn(BaseModel):
    password: str


class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
