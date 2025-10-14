from django.core.management.base import BaseCommand
from backtest_app.models import TimeSeriesData

class Command(BaseCommand):
    help = 'Clear all TimeSeriesData records'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm', 
            action='store_true',
            help='Confirm deletion without prompt'
        )
    
    def handle(self, *args, **options):
        count = TimeSeriesData.objects.count()
        
        if not options['confirm']:
            response = input(f'Are you sure you want to delete {count} records? (yes/no): ')
            if response.lower() != 'yes':
                self.stdout.write('Cancelled')
                return
        
        deleted_count = TimeSeriesData.objects.all().delete()[0]
        self.stdout.write(
            self.style.SUCCESS(f'Successfully deleted {deleted_count} records')
        )