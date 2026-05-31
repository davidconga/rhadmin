<?php

use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BankController;
use App\Http\Controllers\Api\BiometricController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\PositionController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\PaymentOrderController;
use App\Http\Controllers\Api\SalarySlipController;
use App\Http\Controllers\Admin\AuthController as AdminAuthController;
use App\Http\Controllers\Admin\PaymentController as AdminPaymentController;
use App\Http\Controllers\Admin\SettingsController as AdminSettingsController;
use App\Http\Controllers\Admin\SmsAdminController;
use App\Http\Controllers\Admin\PlanController as AdminPlanController;
use App\Http\Controllers\Admin\StatsController as AdminStatsController;
use App\Http\Controllers\Admin\TenantController as AdminTenantController;
use App\Http\Controllers\Api\ApiKeyController;
use App\Http\Controllers\Api\SmsController;
use App\Http\Controllers\Api\SmsRequestController;
use App\Http\Controllers\Api\ExternalController;
use App\Http\Controllers\Api\PlanController;
use App\Http\Controllers\Api\RegisterController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VacationController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\ContractController;
use App\Http\Controllers\Api\EmployeeRegistrationController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\ChannelController;
use App\Http\Controllers\Api\EmployeePortalController;
use App\Http\Controllers\Api\PerformanceController;
use App\Http\Controllers\Api\CareerController;
use Illuminate\Support\Facades\Route;

// ─── Super Admin ──────────────────────────────────────────────
Route::prefix('admin-api')->group(function () {
    Route::post('/login',  [AdminAuthController::class, 'login']);

    Route::middleware('admin')->group(function () {
        Route::get('/me',     [AdminAuthController::class, 'me']);
        Route::post('/logout',[AdminAuthController::class, 'logout']);

        Route::get('/stats',  AdminStatsController::class);

        Route::get('/tenants',                      [AdminTenantController::class, 'index']);
        Route::get('/tenants/{tenant}',             [AdminTenantController::class, 'show']);
        Route::put('/tenants/{tenant}',             [AdminTenantController::class, 'update']);
        Route::delete('/tenants/{tenant}',          [AdminTenantController::class, 'destroy']);
        Route::post('/tenants/{tenant}/impersonate',[AdminTenantController::class, 'impersonate']);

        Route::get('/sms/requests',        [SmsAdminController::class, 'requests']);
        Route::post('/sms/requests/{id}',  [SmsAdminController::class, 'review']);
        Route::get('/sms/config',          [SmsAdminController::class, 'config']);
        Route::post('/sms/config',  [SmsAdminController::class, 'saveConfig']);
        Route::get('/sms/balance',              [SmsAdminController::class, 'balance']);
        Route::post('/sms/test',               [SmsAdminController::class, 'test']);
        Route::get('/sms/usage',               [SmsAdminController::class, 'usage']);
        Route::get('/sms/tenant/{slug}/logs',  [SmsAdminController::class, 'tenantLogs']);

        Route::get('/plans',          [AdminPlanController::class, 'index']);
        Route::post('/plans',         [AdminPlanController::class, 'store']);
        Route::put('/plans/{plan}',   [AdminPlanController::class, 'update']);
        Route::delete('/plans/{plan}',[AdminPlanController::class, 'destroy']);

        Route::get('/settings',        [AdminSettingsController::class, 'show']);
        Route::put('/settings',        [AdminSettingsController::class, 'update']);
        Route::post('/settings/logo',  [AdminSettingsController::class, 'uploadLogo']);

        Route::get('/payments',                    [AdminPaymentController::class, 'index']);
        Route::get('/payments/{payment}/proof',    [AdminPaymentController::class, 'proof']);
        Route::get('/payments/{payment}/fr',       [AdminPaymentController::class, 'downloadFr']);
        Route::post('/payments/{payment}/approve', [AdminPaymentController::class, 'approve']);
        Route::post('/payments/{payment}/reject',  [AdminPaymentController::class, 'reject']);
    });
});

// Planos e registo — público (sem autenticação nem X-Tenant)
Route::get('/plans', [PlanController::class, 'index']);
Route::post('/register', RegisterController::class);
Route::get('/platform/logo', [AdminSettingsController::class, 'logo']);

// API de integração externa — autenticação via X-Api-Key + X-Tenant
Route::get('/external', [ExternalController::class, 'info']);
Route::middleware(['tenant', 'company', 'api.key'])->prefix('external')->group(function () {
    Route::get('/employees',     [ExternalController::class, 'employees']);
    Route::post('/employees',    [ExternalController::class, 'upsertEmployee']);
    Route::post('/attendances',  [ExternalController::class, 'pushAttendance']);
    Route::get('/salary-slips',  [ExternalController::class, 'salarySlips']);
});

/*
 * Todas as rotas exigem o cabeçalho X-Tenant (resolvido pelo TenantMiddleware,
 * que faz switch para a BD SQLite do tenant ANTES da autenticação Sanctum).
 */
Route::middleware('tenant')->group(function () {

    // Autenticação (pública dentro do tenant)
    Route::post('/login', [AuthController::class, 'login']);


    // Auto-registo público do funcionário
    Route::post('/employee-portal/register', [EmployeeRegistrationController::class, 'submit']);

    // Portal — troca de token SMS por sessão (público, sem auth)
    Route::post('/portal/token-login', [EmployeePortalController::class, 'loginWithToken']);

    // Portal do funcionário (autenticado)
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/portal/me',                               [EmployeePortalController::class, 'me']);
        Route::get('/portal/salary-slips',                          [EmployeePortalController::class, 'salarySlips']);
        Route::post('/portal/salary-slips/{id}/confirm',            [EmployeePortalController::class, 'confirmReceipt']);
        Route::get('/portal/salary-slips/{id}/receipt-signature',   [EmployeePortalController::class, 'receiptSignature']);
        Route::get('/portal/salary-slips/{id}/pdf',                 [EmployeePortalController::class, 'downloadPdf']);
        Route::get('/portal/contracts',                             [EmployeePortalController::class, 'contracts']);
        Route::get('/portal/contracts/{id}/pdf',                    [EmployeePortalController::class, 'contractPdf']);
        Route::post('/portal/contracts/{id}/sign',                  [EmployeePortalController::class, 'signContract']);
        Route::post('/portal/signature',                      [EmployeePortalController::class, 'signature']);
        Route::get('/portal/signature',                       [EmployeePortalController::class, 'getSignature']);
        Route::post('/portal/set-password',                   [EmployeePortalController::class, 'setPassword']);
        Route::get('/portal/vacations',                       [EmployeePortalController::class, 'vacations']);
        Route::post('/portal/vacations',                      [EmployeePortalController::class, 'requestVacation']);
        Route::get('/portal/schedule',                        [EmployeePortalController::class, 'schedule']);
        Route::get('/portal/reviews',                         [EmployeePortalController::class, 'reviews']);
    });

    // Rotas acessíveis mesmo com trial expirado
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/subscription', [PlanController::class, 'current']);
        Route::get('/subscription/payment-status', [PlanController::class, 'paymentStatus']);
        Route::get('/subscription/payments', [PlanController::class, 'paymentHistory']);
        Route::get('/subscription/payments/{id}/fr', [PlanController::class, 'downloadFr']);
        Route::middleware('role:admin')->group(function () {
            Route::post('/subscription/upgrade', [PlanController::class, 'upgrade']);
            Route::post('/subscription/proof', [PlanController::class, 'uploadProof']);
        });
    });

    Route::middleware(['auth:sanctum', 'company', 'subscription'])->group(function () {

        // Empresas (multi-empresa por tenant)
        Route::get('/companies', [CompanyController::class, 'index']);
        Route::get('/companies/{company}', [CompanyController::class, 'show']);
        Route::get('/companies/{company}/logo', [CompanyController::class, 'logo']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/companies', [CompanyController::class, 'store']);
            Route::put('/companies/{company}', [CompanyController::class, 'update']);
            Route::delete('/companies/{company}', [CompanyController::class, 'destroy']);
            Route::post('/companies/{company}/logo', [CompanyController::class, 'uploadLogo']);
        });

        // Atalho /company — usa a empresa activa (X-Company) ou a primeira
        Route::get('/company',               [CompanyController::class, 'active']);
        Route::get('/company/logo',          [CompanyController::class, 'activeLogo']);
        Route::get('/company/signature',     [CompanyController::class, 'activeSignature']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::put('/company',                [CompanyController::class, 'updateActive']);
            Route::post('/company/logo',          [CompanyController::class, 'uploadActiveLogo']);
            Route::post('/company/signature',     [CompanyController::class, 'uploadActiveSignature']);
        });

        // Funcionários
        Route::get('/employees', [EmployeeController::class, 'index']);
        Route::get('/employees/options', [EmployeeController::class, 'options']);
        Route::get('/employees/{employee}', [EmployeeController::class, 'show']);
        Route::get('/employees/{employee}/photo', [EmployeeController::class, 'photo']);
        Route::get('/employees/{employee}/family', [EmployeeController::class, 'familyIndex']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/employees', [EmployeeController::class, 'store']);
            Route::put('/employees/{employee}', [EmployeeController::class, 'update']);
            Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy']);
            Route::delete('/employees', [EmployeeController::class, 'destroyBulk']);
            Route::post('/employees/{employee}/photo', [EmployeeController::class, 'uploadPhoto']);
            Route::post('/employees/import', [EmployeeController::class, 'importCsv']);
            Route::post('/employees/{employee}/family', [EmployeeController::class, 'familyStore']);
            Route::put('/employees/{employee}/family/{member}', [EmployeeController::class, 'familyUpdate']);
            Route::delete('/employees/{employee}/family/{member}', [EmployeeController::class, 'familyDestroy']);
            Route::post('/employees/{employee}/reset-portal-password', [EmployeeController::class, 'resetPortalPassword']);
            Route::post('/employees/{employee}/portal-account', [EmployeeController::class, 'createPortalAccount']);
            Route::post('/employees/{employee}/link-user', [EmployeeController::class, 'linkUser']);
        });

        // Recibos de salário
        Route::get('/salary-slips', [SalarySlipController::class, 'index']);
        Route::get('/salary-slips/{salarySlip}', [SalarySlipController::class, 'show']);
        Route::get('/salary-slips/{salarySlip}/receipt-signature', [SalarySlipController::class, 'receiptSignature']);
        Route::post('/salary-slips/download-zip', [SalarySlipController::class, 'downloadZip']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/salary-slips/generate-batch', [SalarySlipController::class, 'generateBatch']);
            Route::put('/salary-slips/{salarySlip}', [SalarySlipController::class, 'update']);
            Route::post('/salary-slips/{salarySlip}/issue', [SalarySlipController::class, 'issue']);
            Route::post('/salary-slips/{salarySlip}/generate-docx', [SalarySlipController::class, 'generateDocx']);
            Route::post('/salary-slips/{salarySlip}/generate-pdf', [SalarySlipController::class, 'generatePdf']);
        });

        // Bancos
        Route::get('/banks', [BankController::class, 'index']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/banks', [BankController::class, 'store']);
            Route::put('/banks/{bank}', [BankController::class, 'update']);
            Route::delete('/banks/{bank}', [BankController::class, 'destroy']);
        });

        // Ordens de pagamento / transferência — Empresarial
        Route::middleware('feature:payment_orders')->group(function () {
        Route::get('/payment-orders', [PaymentOrderController::class, 'index']);
        Route::get('/payment-orders/{paymentOrder}', [PaymentOrderController::class, 'show']);
        Route::get('/payment-orders/{paymentOrder}/generate-excel', [PaymentOrderController::class, 'generateExcel']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/payment-orders', [PaymentOrderController::class, 'store']);
            Route::put('/payment-orders/{paymentOrder}', [PaymentOrderController::class, 'update']);
            Route::delete('/payment-orders/{paymentOrder}', [PaymentOrderController::class, 'destroy']);
            Route::post('/payment-orders/{paymentOrder}/add-employees', [PaymentOrderController::class, 'addEmployees']);
            Route::post('/payment-orders/{paymentOrder}/approve', [PaymentOrderController::class, 'approve']);
            Route::post('/payment-orders/{paymentOrder}/send', [PaymentOrderController::class, 'send']);
            Route::post('/payment-orders/{paymentOrder}/generate-docx', [PaymentOrderController::class, 'generateDocx']);
            Route::post('/payment-orders/{paymentOrder}/generate-pdf', [PaymentOrderController::class, 'generatePdf']);
        });
        }); // feature:payment_orders

        // Assiduidade / Presenças — Profissional+
        Route::middleware('feature:attendance')->group(function () {
        Route::get('/attendances/month', [AttendanceController::class, 'month']);
        Route::get('/attendances/summary', [AttendanceController::class, 'summary']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/attendances', [AttendanceController::class, 'upsert']);
            Route::post('/attendances/bulk', [AttendanceController::class, 'bulk']);
            Route::delete('/attendances/{attendance}', [AttendanceController::class, 'destroy']);
        });
        }); // feature:attendance

        // Férias — Profissional+
        Route::middleware('feature:vacations')->group(function () {
        Route::get('/vacations', [VacationController::class, 'index']);
        Route::get('/vacations/balances', [VacationController::class, 'balances']);
        Route::get('/vacations/calendar', [VacationController::class, 'calendar']);
        Route::get('/vacations/working-days', [VacationController::class, 'workingDays']);
        Route::get('/vacations/{vacation}', [VacationController::class, 'show']);
        Route::post('/vacations', [VacationController::class, 'store']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/vacations/{vacation}/approve', [VacationController::class, 'approve']);
            Route::post('/vacations/{vacation}/reject', [VacationController::class, 'reject']);
            Route::put('/employees/{employee}/vacation-balance', [VacationController::class, 'updateBalance']);
        });
        Route::post('/vacations/{vacation}/cancel', [VacationController::class, 'cancel']);
        }); // feature:vacations

        // Escalas / Turnos — Profissional+
        Route::middleware('feature:schedules')->group(function () {
        Route::get('/shifts', [ShiftController::class, 'indexShifts']);
        Route::get('/shifts/month', [ShiftController::class, 'month']);
        Route::get('/shifts/summary', [ShiftController::class, 'summary']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/shifts', [ShiftController::class, 'storeShift']);
            Route::put('/shifts/{shift}', [ShiftController::class, 'updateShift']);
            Route::delete('/shifts/{shift}', [ShiftController::class, 'destroyShift']);
            Route::post('/shifts/assign', [ShiftController::class, 'assign']);
            Route::post('/shifts/bulk-assign', [ShiftController::class, 'bulkAssign']);
            Route::post('/shifts/auto-rest', [ShiftController::class, 'autoRest']);
        });
        }); // feature:schedules

        // Biométricos — Empresarial
        Route::middleware('feature:biometrics')->group(function () {
        Route::get('/biometric/devices', [BiometricController::class, 'index']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/biometric/devices', [BiometricController::class, 'store']);
            Route::put('/biometric/devices/{device}', [BiometricController::class, 'update']);
            Route::delete('/biometric/devices/{device}', [BiometricController::class, 'destroy']);
            Route::post('/biometric/devices/{device}/test', [BiometricController::class, 'testConnection']);
            Route::post('/biometric/import', [BiometricController::class, 'import']);
            Route::post('/biometric/punches', [BiometricController::class, 'punches']);
        });
        }); // feature:biometrics

        // Departamentos
        Route::get('/departments', [DepartmentController::class, 'index']);
        Route::get('/departments/{department}', [DepartmentController::class, 'show']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/departments', [DepartmentController::class, 'store']);
            Route::put('/departments/{department}', [DepartmentController::class, 'update']);
            Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);
        });

        Route::get('/positions', [PositionController::class, 'index']);
        Route::get('/positions/{position}', [PositionController::class, 'show']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/positions', [PositionController::class, 'store']);
            Route::put('/positions/{position}', [PositionController::class, 'update']);
            Route::delete('/positions/{position}', [PositionController::class, 'destroy']);
        });

        // Configurações (IRT, INSS, ...)
        Route::get('/settings', [SettingsController::class, 'show']);
        Route::middleware('role:admin,manager')->put('/settings', [SettingsController::class, 'update']);

        // SMS — pedido de acesso e envio via plataforma
        Route::get('/sms/request',   [SmsRequestController::class, 'status']);
        Route::post('/sms/request',  [SmsRequestController::class, 'submit']);
        Route::post('/sms/platform-send', [SmsRequestController::class, 'send']);

        // SMS / Telco
        Route::get('/sms/settings',  [SmsController::class, 'settings']);
        Route::get('/sms/logs',      [SmsController::class, 'logs']);
        Route::get('/sms/templates', [SmsController::class, 'templates']);
        Route::get('/sms/balance',   [SmsController::class, 'balance']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::put('/sms/settings', [SmsController::class, 'saveSettings']);
            Route::post('/sms/test',    [SmsController::class, 'test']);
        });

        // Documentos
        Route::get('/documents', [DocumentController::class, 'index']);
        Route::get('/documents/{document}/download', [DocumentController::class, 'download']);

        // API Keys — Empresarial
        Route::middleware(['feature:api_keys', 'role:admin'])->group(function () {
            Route::get('/api-keys', [ApiKeyController::class, 'index']);
            Route::post('/api-keys', [ApiKeyController::class, 'store']);
            Route::put('/api-keys/{apiKey}', [ApiKeyController::class, 'update']);
            Route::delete('/api-keys/{apiKey}', [ApiKeyController::class, 'destroy']);
        });

        // Utilizadores e permissões (apenas admin)
        Route::middleware('role:admin')->group(function () {
            Route::get('/users', [UserController::class, 'index']);
            Route::post('/users', [UserController::class, 'store']);
            Route::get('/users/{user}', [UserController::class, 'show']);
            Route::put('/users/{user}', [UserController::class, 'update']);
            Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword']);
            Route::delete('/users/{user}', [UserController::class, 'destroy']);
        });

        // Contratos
        Route::get('/contracts',                        [ContractController::class, 'index']);
        Route::get('/contracts/{contract}',             [ContractController::class, 'show']);
        Route::get('/contracts/{contract}/generate-pdf',[ContractController::class, 'generatePdf']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/contracts',             [ContractController::class, 'store']);
            Route::put('/contracts/{contract}',   [ContractController::class, 'update']);
            Route::delete('/contracts/{contract}',[ContractController::class, 'destroy']);
        });

        // Pedidos de registo de funcionários
        Route::middleware('role:admin,manager')->group(function () {
            Route::get('/employee-registrations',                         [EmployeeRegistrationController::class, 'index']);
            Route::post('/employee-registrations/invite',                 [EmployeeRegistrationController::class, 'invite']);
            Route::post('/employee-registrations/{registration}/approve', [EmployeeRegistrationController::class, 'approve']);
            Route::post('/employee-registrations/{registration}/reject',  [EmployeeRegistrationController::class, 'reject']);
        });

        // Assinatura do funcionário (admin/manager pode ver)
        Route::get('/employees/{employee}/signature', [EmployeeController::class, 'getSignature']);
        Route::middleware('role:admin,manager')->post('/employees/{employee}/signature', [EmployeeController::class, 'uploadSignature']);

        // Avaliação & Desempenho
        Route::get('/review-criteria', [PerformanceController::class, 'criteria']);
        Route::get('/performance-reviews', [PerformanceController::class, 'index']);
        Route::get('/performance-reviews/{review}', [PerformanceController::class, 'show']);
        Route::get('/performance-reviews/{review}/pdf', [PerformanceController::class, 'downloadPdf']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/review-criteria', [PerformanceController::class, 'storeCriterion']);
            Route::put('/review-criteria/{criterion}', [PerformanceController::class, 'updateCriterion']);
            Route::delete('/review-criteria/{criterion}', [PerformanceController::class, 'destroyCriterion']);
            Route::post('/performance-reviews', [PerformanceController::class, 'store']);
            Route::post('/performance-reviews/full', [PerformanceController::class, 'storeFull']);
            Route::put('/performance-reviews/{review}', [PerformanceController::class, 'update']);
            Route::post('/performance-reviews/{review}/scores', [PerformanceController::class, 'saveScores']);
            Route::post('/performance-reviews/{review}/complete', [PerformanceController::class, 'complete']);
            Route::delete('/performance-reviews/{review}', [PerformanceController::class, 'destroy']);
        });

        // Chat / Mensagens
        Route::get('/chat/unread',                   [ChatController::class, 'unreadCount']);
        Route::get('/chat/conversations',             [ChatController::class, 'conversations']);
        Route::post('/chat/conversations',            [ChatController::class, 'findOrCreate']);
        Route::get('/chat/conversations/{id}/messages', [ChatController::class, 'messages']);
        Route::post('/chat/conversations/{id}/messages',[ChatController::class, 'send']);

        // Canais públicos
        Route::get('/channels',                        [ChannelController::class, 'index']);
        Route::get('/channels/{id}/messages',          [ChannelController::class, 'messages']);
        Route::post('/channels/{id}/messages',         [ChannelController::class, 'send']);

        // Carreira
        Route::get('/employees/{employee}/career', [CareerController::class, 'index']);
        Route::middleware('role:admin,manager')->group(function () {
            Route::post('/employees/{employee}/career', [CareerController::class, 'store']);
            Route::put('/employees/{employee}/career/{event}', [CareerController::class, 'update']);
            Route::delete('/employees/{employee}/career/{event}', [CareerController::class, 'destroy']);
        });
    });
});
