from django.urls import path, re_path
from . import views

urlpatterns = [
    # Strona główna
    path('', views.home_view, name='home'),
    
    # Symbol z datą początkową (do końca dostępnych danych)
    # Obsługuje zarówno /ES/2023-01-01/ jak i /NQ/2023-01-01/
    re_path(r'^(?P<symbol>[\w\-]+)/(?P<start_date>\d{4}-\d{2}-\d{2})/$', 
            views.symbol_date_view, name='symbol_date'),
    
    # Symbol z zakresem dat
    # Obsługuje zarówno /ES/2023-01-01/2023-02-01/ jak i /NQ/2023-01-01/2023-02-01/
    re_path(r'^(?P<symbol>[\w\-]+)/(?P<start_date>\d{4}-\d{2}-\d{2})/(?P<end_date>\d{4}-\d{2}-\d{2})/$', 
            views.symbol_date_range_view, name='symbol_date_range'),


    path('save-session/', views.save_backtesting_session, name='save_session'),
    path('load-session/<int:session_id>/', views.load_backtesting_session, name='load_session'),
    path('chart/session/<int:session_id>/', views.chart_from_session, name='chart_from_session')
]