<?php

namespace App\Providers;

use App\Application\Transactions\Contracts\TransactionSource;
use App\Infrastructure\Transactions\Sources\LocalJsonTransactionSource;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            TransactionSource::class,
            fn () => new LocalJsonTransactionSource(
                (string) config('transactions.fixture_directory'),
            ),
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
