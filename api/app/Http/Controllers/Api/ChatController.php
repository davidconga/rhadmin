<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChatController extends Controller
{
    /** Lista conversas do utilizador autenticado com última mensagem e não lidos. */
    public function conversations(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $convIds = DB::table('conversation_participants')
            ->where('user_id', $userId)
            ->pluck('conversation_id');

        $conversations = [];
        foreach ($convIds as $cid) {
            $lastMsg = DB::table('messages')
                ->where('conversation_id', $cid)
                ->latest()
                ->first();

            if (! $lastMsg) continue;

            $lastRead = DB::table('conversation_participants')
                ->where('conversation_id', $cid)
                ->where('user_id', $userId)
                ->value('last_read_at');

            $unread = DB::table('messages')
                ->where('conversation_id', $cid)
                ->where('sender_id', '!=', $userId)
                ->when($lastRead, fn ($q) => $q->where('created_at', '>', $lastRead))
                ->count();

            // Obter os outros participantes
            $otherIds = DB::table('conversation_participants')
                ->where('conversation_id', $cid)
                ->where('user_id', '!=', $userId)
                ->pluck('user_id');

            $others = \App\Models\User::whereIn('id', $otherIds)
                ->get(['id', 'name', 'role', 'employee_id']);

            $conversations[] = [
                'id'           => $cid,
                'participants' => $others,
                'last_message' => $lastMsg,
                'unread'       => $unread,
                'updated_at'   => $lastMsg->created_at,
            ];
        }

        usort($conversations, fn ($a, $b) => strcmp($b['updated_at'], $a['updated_at']));

        return response()->json($conversations);
    }

    /** Cria ou devolve conversa existente com outro utilizador. */
    public function findOrCreate(Request $request): JsonResponse
    {
        $request->validate(['user_id' => ['required', 'integer']]);
        $userId  = $request->user()->id;
        $otherId = (int) $request->input('user_id');

        if ($userId === $otherId) {
            return response()->json(['message' => 'Não pode iniciar conversa consigo próprio.'], 422);
        }

        // Procura conversa directa existente entre os dois
        $existing = DB::table('conversation_participants as a')
            ->join('conversation_participants as b', 'a.conversation_id', '=', 'b.conversation_id')
            ->where('a.user_id', $userId)
            ->where('b.user_id', $otherId)
            ->value('a.conversation_id');

        if ($existing) {
            return response()->json(['id' => $existing]);
        }

        // Cria nova conversa
        $now = now();
        $cid = DB::table('conversations')->insertGetId(['created_at' => $now, 'updated_at' => $now]);
        DB::table('conversation_participants')->insert([
            ['conversation_id' => $cid, 'user_id' => $userId,  'created_at' => $now, 'updated_at' => $now],
            ['conversation_id' => $cid, 'user_id' => $otherId, 'created_at' => $now, 'updated_at' => $now],
        ]);

        return response()->json(['id' => $cid], 201);
    }

    /** Mensagens de uma conversa. */
    public function messages(Request $request, int $id): JsonResponse
    {
        $userId = $request->user()->id;

        // Verifica se o utilizador é participante
        $isParticipant = DB::table('conversation_participants')
            ->where('conversation_id', $id)
            ->where('user_id', $userId)
            ->exists();

        if (! $isParticipant) {
            return response()->json(['message' => 'Sem acesso.'], 403);
        }

        // Marca como lido
        DB::table('conversation_participants')
            ->where('conversation_id', $id)
            ->where('user_id', $userId)
            ->update(['last_read_at' => now(), 'updated_at' => now()]);

        $messages = DB::table('messages')
            ->where('conversation_id', $id)
            ->orderBy('created_at')
            ->get();

        // Enriquece com dados do remetente
        $userIds = $messages->pluck('sender_id')->unique();
        $users = \App\Models\User::whereIn('id', $userIds)->get(['id','name','role'])->keyBy('id');

        $enriched = $messages->map(fn ($m) => [
            'id'              => $m->id,
            'conversation_id' => $m->conversation_id,
            'sender_id'       => $m->sender_id,
            'sender'          => $users[$m->sender_id] ?? null,
            'body'            => $m->body,
            'created_at'      => $m->created_at,
        ]);

        return response()->json($enriched);
    }

    /** Envia mensagem. */
    public function send(Request $request, int $id): JsonResponse
    {
        $request->validate(['body' => ['required', 'string', 'max:2000']]);
        $userId = $request->user()->id;

        $isParticipant = DB::table('conversation_participants')
            ->where('conversation_id', $id)
            ->where('user_id', $userId)
            ->exists();

        if (! $isParticipant) {
            return response()->json(['message' => 'Sem acesso.'], 403);
        }

        $now = now();
        $msgId = DB::table('messages')->insertGetId([
            'conversation_id' => $id,
            'sender_id'       => $userId,
            'body'            => $request->input('body'),
            'created_at'      => $now,
            'updated_at'      => $now,
        ]);

        DB::table('conversations')->where('id', $id)->update(['updated_at' => $now]);

        $msg = DB::table('messages')->find($msgId);
        $sender = $request->user()->only(['id','name','role']);

        return response()->json([
            'id'              => $msg->id,
            'conversation_id' => $msg->conversation_id,
            'sender_id'       => $msg->sender_id,
            'sender'          => $sender,
            'body'            => $msg->body,
            'created_at'      => $msg->created_at,
        ], 201);
    }

    /** Total de mensagens não lidas do utilizador. */
    public function unreadCount(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $convIds = DB::table('conversation_participants')
            ->where('user_id', $userId)
            ->pluck('conversation_id');

        $total = 0;
        foreach ($convIds as $cid) {
            $lastRead = DB::table('conversation_participants')
                ->where('conversation_id', $cid)
                ->where('user_id', $userId)
                ->value('last_read_at');

            $total += DB::table('messages')
                ->where('conversation_id', $cid)
                ->where('sender_id', '!=', $userId)
                ->when($lastRead, fn ($q) => $q->where('created_at', '>', $lastRead))
                ->count();
        }

        return response()->json(['unread' => $total]);
    }
}
