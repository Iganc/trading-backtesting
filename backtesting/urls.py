"""
URL configuration for backtesting project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from backtest_app.views import SP500View

urlpatterns = [
    path('admin/', admin.site.urls),
    path('sp500/<str:date>/', SP500View.as_view(), name='SP500'),
    path('sp500/period/<str:startdate>/<str:enddate>/', SP500View.as_view(), name='SP500')
]

