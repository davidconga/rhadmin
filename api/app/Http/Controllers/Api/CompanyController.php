<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\PlanLimitService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CompanyController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Company::orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        if ($err = app(PlanLimitService::class)->checkCompanies($request->attributes->get('tenant'))) {
            return $err;
        }

        $data = $request->validate([
            'name'                 => ['required', 'string', 'max:255'],
            'nif'                  => ['nullable', 'string', 'max:100'],
            'address'              => ['nullable', 'string', 'max:255'],
            'phone'                => ['nullable', 'string', 'max:100'],
            'email'                => ['nullable', 'email', 'max:255'],
            'bank_name'            => ['nullable', 'string', 'max:255'],
            'account_number'       => ['nullable', 'string', 'max:100'],
            'iban'                 => ['nullable', 'string', 'max:64'],
            'default_debit_account'=> ['nullable', 'string', 'max:100'],
            'currency'             => ['nullable', 'string', 'max:8'],
            'active'               => ['boolean'],
        ]);

        $company = Company::create($data + ['active' => true]);
        Audit::log('created', $company);

        return response()->json($company, 201);
    }

    public function show(Company $company): JsonResponse
    {
        return response()->json($company);
    }

    public function update(Request $request, Company $company): JsonResponse
    {
        $data = $request->validate([
            'name'                 => ['sometimes', 'required', 'string', 'max:255'],
            'nif'                  => ['nullable', 'string', 'max:100'],
            'address'              => ['nullable', 'string', 'max:255'],
            'phone'                => ['nullable', 'string', 'max:100'],
            'email'                => ['nullable', 'email', 'max:255'],
            'bank_name'            => ['nullable', 'string', 'max:255'],
            'account_number'       => ['nullable', 'string', 'max:100'],
            'iban'                 => ['nullable', 'string', 'max:64'],
            'default_debit_account'=> ['nullable', 'string', 'max:100'],
            'currency'             => ['nullable', 'string', 'max:8'],
            'active'               => ['boolean'],
        ]);

        $old = $company->getOriginal();
        $company->update($data);
        Audit::log('updated', $company, $old);

        return response()->json($company);
    }

    public function destroy(Company $company): JsonResponse
    {
        Audit::log('deleted', $company);
        $company->delete();

        return response()->json(null, 204);
    }

    public function uploadLogo(Request $request, Company $company): JsonResponse
    {
        $request->validate([
            'logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
        ]);

        $tenant = $request->attributes->get('tenant');
        $path = $request->file('logo')->store("tenant/{$tenant->slug}/companies/{$company->id}/logo", 'local');

        if ($company->logo_path && Storage::disk('local')->exists($company->logo_path)) {
            Storage::disk('local')->delete($company->logo_path);
        }

        $company->update(['logo_path' => $path]);

        return response()->json(['logo_path' => $path]);
    }

    public function logo(Company $company)
    {
        abort_if(! $company->logo_path || ! Storage::disk('local')->exists($company->logo_path), 404);

        return Storage::disk('local')->response($company->logo_path);
    }

    // ── Atalhos /company ────────────────────────────────────────────────────

    private function resolveActive(Request $request): ?Company
    {
        if ($id = $request->attributes->get('company_id')) {
            return Company::find($id);
        }
        return Company::first();
    }

    public function active(Request $request): JsonResponse
    {
        $company = $this->resolveActive($request);
        if (! $company) {
            return response()->json(null, 204);
        }
        return response()->json($company);
    }

    public function activeLogo(Request $request)
    {
        $company = $this->resolveActive($request);
        abort_if(! $company || ! $company->logo_path || ! Storage::disk('local')->exists($company->logo_path), 404);
        return Storage::disk('local')->response($company->logo_path);
    }

    public function updateActive(Request $request): JsonResponse
    {
        $company = $this->resolveActive($request);

        $data = $request->validate([
            'name'                 => ['sometimes', 'required', 'string', 'max:255'],
            'nif'                  => ['nullable', 'string', 'max:100'],
            'address'              => ['nullable', 'string', 'max:255'],
            'phone'                => ['nullable', 'string', 'max:100'],
            'email'                => ['nullable', 'email', 'max:255'],
            'bank_name'            => ['nullable', 'string', 'max:255'],
            'account_number'       => ['nullable', 'string', 'max:100'],
            'iban'                 => ['nullable', 'string', 'max:64'],
            'default_debit_account'=> ['nullable', 'string', 'max:100'],
            'currency'             => ['nullable', 'string', 'max:8'],
            'active'               => ['boolean'],
        ]);

        if (! $company) {
            $company = Company::create($data + ['active' => true]);
            Audit::log('created', $company);
            return response()->json($company, 201);
        }

        $old = $company->getOriginal();
        $company->update($data);
        Audit::log('updated', $company, $old);

        return response()->json($company);
    }

    public function uploadActiveLogo(Request $request): JsonResponse
    {
        $company = $this->resolveActive($request);
        abort_if(! $company, 404);
        return $this->uploadLogo($request, $company);
    }

    public function uploadSignature(Request $request, Company $company): JsonResponse
    {
        $request->validate(['signature' => ['required', 'string']]);

        $base64 = preg_replace('#^data:image/\w+;base64,#i', '', $request->input('signature'));
        $tenant = $request->attributes->get('tenant');
        $path   = "tenant/{$tenant->slug}/companies/{$company->id}/signature.png";
        Storage::disk('local')->put($path, base64_decode($base64));

        if ($company->signature_path && $company->signature_path !== $path) {
            Storage::disk('local')->delete($company->signature_path);
        }

        $company->update(['signature_path' => $path]);

        return response()->json(['message' => 'Assinatura guardada.']);
    }

    public function signature(Company $company)
    {
        abort_if(! $company->signature_path || ! Storage::disk('local')->exists($company->signature_path), 404);
        return Storage::disk('local')->response($company->signature_path);
    }

    public function uploadActiveSignature(Request $request): JsonResponse
    {
        $company = $this->resolveActive($request);
        abort_if(! $company, 404);
        return $this->uploadSignature($request, $company);
    }

    public function activeSignature(Request $request)
    {
        $company = $this->resolveActive($request);
        abort_if(! $company, 404);
        return $this->signature($company);
    }
}
