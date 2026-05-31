<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant'       => \App\Http\Middleware\TenantMiddleware::class,
            'role'         => \App\Http\Middleware\RoleMiddleware::class,
            'company'      => \App\Http\Middleware\CompanyMiddleware::class,
            'api.key'      => \App\Http\Middleware\ApiKeyMiddleware::class,
            'admin'        => \App\Http\Middleware\AdminMiddleware::class,
            'subscription' => \App\Http\Middleware\SubscriptionMiddleware::class,
            'feature'      => \App\Http\Middleware\PlanFeatureMiddleware::class,
        ]);

        // Garante que o switch de tenant ocorre ANTES da autenticação Sanctum,
        // caso contrário o lookup do token acerta na BD errada. A lista de
        // prioridade do Laravel usa o CONTRATO AuthenticatesRequests (não a
        // classe concreta Authenticate), por isso prependemos antes dele.
        $middleware->prependToPriorityList(
            \Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests::class,
            \App\Http\Middleware\TenantMiddleware::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
