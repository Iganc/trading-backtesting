from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password1", "password2")

class EmailOrUsernameAuthenticationForm(forms.Form):
    identifier = forms.CharField(label="Login lub email")
    password = forms.CharField(widget=forms.PasswordInput)