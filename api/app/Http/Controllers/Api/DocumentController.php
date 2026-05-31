<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Document::query()->latest('generated_at')->limit(50)->get()
        );
    }

    public function download(Document $document): StreamedResponse
    {
        abort_unless(Storage::disk('local')->exists($document->path), 404, 'Ficheiro não encontrado.');

        return Storage::disk('local')->download($document->path, $document->filename);
    }
}
