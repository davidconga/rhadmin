<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChannelController extends Controller
{
    /** Lista todos os canais públicos. */
    public function index(): JsonResponse
    {
        $channels = DB::table('channels')->orderBy('name')->get();
        return response()->json($channels);
    }

    /** Mensagens de um canal (últimas 100, ordem crescente). */
    public function messages(Request $request, int $id): JsonResponse
    {
        $exists = DB::table('channels')->where('id', $id)->exists();
        if (! $exists) {
            return response()->json(['message' => 'Canal não encontrado.'], 404);
        }

        $messages = DB::table('channel_messages')
            ->where('channel_id', $id)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->reverse()
            ->values();

        $userIds = $messages->pluck('sender_id')->unique();
        $users = \App\Models\User::whereIn('id', $userIds)
            ->get(['id', 'name', 'role'])
            ->keyBy('id');

        $enriched = $messages->map(fn ($m) => [
            'id'         => $m->id,
            'channel_id' => $m->channel_id,
            'sender_id'  => $m->sender_id,
            'sender'     => $users[$m->sender_id] ?? null,
            'body'       => $m->body,
            'created_at' => $m->created_at,
        ]);

        return response()->json($enriched);
    }

    /** Envia mensagem para um canal. */
    public function send(Request $request, int $id): JsonResponse
    {
        $request->validate(['body' => ['required', 'string', 'max:2000']]);

        $exists = DB::table('channels')->where('id', $id)->exists();
        if (! $exists) {
            return response()->json(['message' => 'Canal não encontrado.'], 404);
        }

        $now   = now();
        $msgId = DB::table('channel_messages')->insertGetId([
            'channel_id' => $id,
            'sender_id'  => $request->user()->id,
            'body'       => $request->input('body'),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $msg    = DB::table('channel_messages')->find($msgId);
        $sender = $request->user()->only(['id', 'name', 'role']);

        return response()->json([
            'id'         => $msg->id,
            'channel_id' => $msg->channel_id,
            'sender_id'  => $msg->sender_id,
            'sender'     => $sender,
            'body'       => $msg->body,
            'created_at' => $msg->created_at,
        ], 201);
    }
}
