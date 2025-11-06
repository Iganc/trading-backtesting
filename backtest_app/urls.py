from django.urls import path, re_path
from . import views

urlpatterns = [
    path('', views.home_view, name='home'),
    
    re_path(r'^(?P<symbol>[\w\-]+)/(?P<start_date>\d{4}-\d{2}-\d{2})/$', 
            views.symbol_date_view, name='symbol_date'),
    
    re_path(r'^(?P<symbol>[\w\-]+)/(?P<start_date>\d{4}-\d{2}-\d{2})/(?P<end_date>\d{4}-\d{2}-\d{2})/$', 
            views.symbol_date_range_view, name='symbol_date_range'),


    path('save-session/', views.save_backtesting_session, name='save_session'),
    path('load-session/<int:session_id>/', views.load_backtesting_session, name='load_session'),
    path('chart/session/<int:session_id>/', views.chart_from_session, name='chart_from_session')
]