<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLabelRequest;
use App\Http\Resources\LabelResource;
use App\Models\Label;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LabelController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return LabelResource::collection(Label::orderByRaw('lower(name)')->get());
    }

    public function store(StoreLabelRequest $request): JsonResponse
    {
        return (new LabelResource(Label::create($request->validated())))->response()->setStatusCode(201);
    }
}
