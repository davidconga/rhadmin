<?php

namespace App\Http\Middleware;

use App\Models\Company;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CompanyMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($companyId = $request->header('X-Company')) {
            $company = Company::find((int) $companyId);
            if ($company) {
                $request->attributes->set('company', $company);
                $request->attributes->set('company_id', $company->id);
            }
        }

        return $next($request);
    }
}
