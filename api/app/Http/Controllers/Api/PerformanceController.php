<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PerformanceReview;
use App\Models\PerformanceReviewCriterion;
use App\Models\PerformanceReviewScore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PerformanceController extends Controller
{
    // ── Critérios ────────────────────────────────────────────────────────────

    public function criteria(): JsonResponse
    {
        return response()->json(PerformanceReviewCriterion::orderBy('category')->orderBy('name')->get());
    }

    public function storeCriterion(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'category'    => ['required', 'string', 'max:100'],
            'weight'      => ['required', 'numeric', 'min:1', 'max:100'],
            'description' => ['nullable', 'string'],
            'active'      => ['boolean'],
        ]);
        return response()->json(PerformanceReviewCriterion::create($data), 201);
    }

    public function updateCriterion(Request $request, PerformanceReviewCriterion $criterion): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['sometimes', 'string', 'max:255'],
            'category'    => ['sometimes', 'string', 'max:100'],
            'weight'      => ['sometimes', 'numeric', 'min:1', 'max:100'],
            'description' => ['nullable', 'string'],
            'active'      => ['boolean'],
        ]);
        $criterion->update($data);
        return response()->json($criterion);
    }

    public function destroyCriterion(PerformanceReviewCriterion $criterion): JsonResponse
    {
        $criterion->delete();
        return response()->json(null, 204);
    }

    // ── Avaliação completa (criar + pontuar + concluir numa só chamada) ──────

    public function storeFull(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id'       => ['required', 'integer', 'exists:employees,id'],
            'period_year'       => ['required', 'integer', 'min:2020', 'max:2100'],
            'period_type'       => ['required', Rule::in(['annual', 'semi_annual', 'quarterly'])],
            'period_number'     => ['required', 'integer', 'min:1', 'max:4'],
            'reviewer_comments' => ['nullable', 'string'],
            'status'            => ['required', Rule::in(['draft', 'completed'])],
            'method'            => ['nullable', Rule::in(['standard', '360', 'self', 'apo'])],
            'scores'            => ['nullable', 'array'],
            'scores.*.criterion_id' => ['required', 'integer', 'exists:performance_review_criteria,id'],
            'scores.*.score'        => ['required', 'integer', 'min:1', 'max:5'],
            'scores.*.comment'      => ['nullable', 'string'],
        ]);

        // Se já existe uma avaliação não-concluída para este período, actualiza-a
        $existing = PerformanceReview::where('employee_id', $data['employee_id'])
            ->where('period_year', $data['period_year'])
            ->where('period_type', $data['period_type'])
            ->where('period_number', $data['period_number'])
            ->first();

        if ($existing && $existing->status === 'completed') {
            return response()->json([
                'message' => 'Já existe uma avaliação concluída para este período. Não é possível substituí-la.',
            ], 422);
        }

        $review = PerformanceReview::updateOrCreate(
            [
                'employee_id'   => $data['employee_id'],
                'period_year'   => $data['period_year'],
                'period_type'   => $data['period_type'],
                'period_number' => $data['period_number'],
            ],
            [
                'reviewer_id'       => $request->user()->id,
                'reviewer_comments' => $data['reviewer_comments'] ?? null,
                'status'            => $data['status'],
                'method'            => $data['method'] ?? 'standard',
                'conducted_at'      => $data['status'] === 'completed' ? now() : null,
            ]
        );

        foreach ($data['scores'] ?? [] as $s) {
            PerformanceReviewScore::updateOrCreate(
                ['review_id' => $review->id, 'criterion_id' => $s['criterion_id']],
                ['score' => $s['score'], 'comment' => $s['comment'] ?? null]
            );
        }

        $review->recalcOverallScore();

        return response()->json(
            $review->fresh()->load(['employee:id,full_name,position,department', 'reviewer:id,name', 'scores.criterion']),
            201
        );
    }

    // ── Avaliações ───────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = PerformanceReview::with(['employee:id,full_name,position,department', 'reviewer:id,name'])
            ->orderByDesc('period_year')
            ->orderByDesc('conducted_at');

        if ($request->filled('employee_id')) $query->where('employee_id', $request->query('employee_id'));
        if ($request->filled('status'))      $query->where('status', $request->query('status'));
        if ($request->filled('year'))        $query->where('period_year', $request->query('year'));

        return response()->json($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id'   => ['required', 'integer', 'exists:employees,id'],
            'period_year'   => ['required', 'integer', 'min:2020', 'max:2100'],
            'period_type'   => ['required', Rule::in(['annual', 'semi_annual', 'quarterly'])],
            'period_number' => ['required', 'integer', 'min:1', 'max:4'],
        ]);

        $review = PerformanceReview::create([
            ...$data,
            'reviewer_id' => $request->user()->id,
            'status'      => 'draft',
        ]);

        return response()->json($review->load(['employee:id,full_name', 'reviewer:id,name']), 201);
    }

    public function show(PerformanceReview $review): JsonResponse
    {
        return response()->json(
            $review->load([
                'employee:id,full_name,position,department',
                'reviewer:id,name',
                'scores.criterion',
            ])
        );
    }

    public function update(Request $request, PerformanceReview $review): JsonResponse
    {
        if ($review->status === 'completed') {
            return response()->json(['message' => 'Avaliação concluída não pode ser editada.'], 422);
        }

        $data = $request->validate([
            'status'             => ['sometimes', Rule::in(['draft', 'in_progress'])],
            'reviewer_comments'  => ['nullable', 'string'],
        ]);

        $review->update($data);
        return response()->json($review);
    }

    public function saveScores(Request $request, PerformanceReview $review): JsonResponse
    {
        if ($review->status === 'completed') {
            return response()->json(['message' => 'Avaliação concluída não pode ser editada.'], 422);
        }

        $request->validate([
            'scores'               => ['required', 'array'],
            'scores.*.criterion_id'=> ['required', 'integer', 'exists:performance_review_criteria,id'],
            'scores.*.score'       => ['required', 'integer', 'min:1', 'max:5'],
            'scores.*.comment'     => ['nullable', 'string'],
        ]);

        foreach ($request->input('scores') as $s) {
            PerformanceReviewScore::updateOrCreate(
                ['review_id' => $review->id, 'criterion_id' => $s['criterion_id']],
                ['score' => $s['score'], 'comment' => $s['comment'] ?? null]
            );
        }

        if ($review->status === 'draft') {
            $review->update(['status' => 'in_progress']);
        }

        $review->recalcOverallScore();

        return response()->json($review->fresh()->load('scores.criterion'));
    }

    public function complete(Request $request, PerformanceReview $review): JsonResponse
    {
        if ($review->status === 'completed') {
            return response()->json(['message' => 'Já concluída.'], 422);
        }

        $data = $request->validate([
            'reviewer_comments' => ['nullable', 'string'],
        ]);

        $review->recalcOverallScore();
        $review->update([
            ...$data,
            'status'       => 'completed',
            'conducted_at' => now(),
        ]);

        return response()->json($review->fresh()->load(['scores.criterion', 'reviewer:id,name']));
    }

    public function downloadPdf(PerformanceReview $review)
    {
        $review->load(['employee', 'reviewer:id,name', 'scores.criterion']);

        $company = \App\Models\Company::first();

        // Agrupa scores por categoria, ordenando categorias por nome
        $groupedScores = $review->scores
            ->sortBy(fn ($s) => $s->criterion->category . $s->criterion->name)
            ->groupBy(fn ($s) => $s->criterion->category);

        $periodLabel = $review->periodLabel();

        $methodLabels = [
            'standard' => 'Avaliação pela Chefia',
            '360'      => 'Avaliação 360°',
            'self'     => 'Autoavaliação',
            'apo'      => 'Avaliação por Objectivos (APO)',
        ];

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('documents.performance_review', [
            'review'           => $review,
            'employee'         => $review->employee,
            'reviewerName'     => $review->reviewer?->name ?? 'RH',
            'companyName'      => $company?->name ?? 'Empresa',
            'companyNif'       => $company?->nif ?? '',
            'periodLabel'      => $periodLabel,
            'methodLabel'      => $methodLabels[$review->method ?? 'standard'] ?? 'Avaliação pela Chefia',
            'conductedAt'      => $review->conducted_at?->format('d/m/Y') ?? now()->format('d/m/Y'),
            'groupedScores'    => $groupedScores,
            'reviewerComments' => $review->reviewer_comments,
            'generatedAt'      => now()->format('d/m/Y H:i'),
            'scoreLabels'      => ['', 'Insuficiente', 'Necessita melhoria', 'Satisfatório', 'Bom', 'Excelente'],
        ]);

        $pdf->setPaper('A4', 'portrait');

        $filename = 'avaliacao-' . \Illuminate\Support\Str::slug($review->employee->full_name) . '-' . $periodLabel . '.pdf';

        return response($pdf->output(), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }

    public function destroy(PerformanceReview $review): JsonResponse
    {
        $review->delete();
        return response()->json(null, 204);
    }
}
