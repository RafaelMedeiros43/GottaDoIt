<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateMeRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function update(UpdateMeRequest $request): UserResource
    {
        $user = $request->user();
        $data = $request->validated();

        if (isset($data['notification_settings'])) {
            $data['notification_settings'] = array_merge(
                $user->notification_settings ?? [], $data['notification_settings']
            );
        }

        $user->update($data);

        return new UserResource($user);
    }
}
