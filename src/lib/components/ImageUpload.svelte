<script lang="ts">
	import type { Attachment } from '$lib/types/index.js';

	interface Props {
		noteId: string;
		attachments: Attachment[];
		onUpload: (attachment: Attachment) => void;
		onRemove: (attachmentId: string) => void;
	}

	let { noteId, attachments = [], onUpload, onRemove }: Props = $props();

	let uploading = $state(false);
	let dragOver = $state(false);

	async function handleFiles(files: FileList | null) {
		if (!files || !noteId) return;

		uploading = true;
		for (const file of files) {
			if (!file.type.startsWith('image/')) continue;

			const formData = new FormData();
			formData.append('file', file);

			try {
				const res = await fetch(`/api/notes/${noteId}/attachments`, {
					method: 'POST',
					body: formData
				});
				if (res.ok) {
					const attachment = await res.json();
					onUpload(attachment);
				}
			} catch (err) {
				console.error('Upload failed:', err);
			}
		}
		uploading = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		handleFiles(e.dataTransfer?.files ?? null);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}
</script>

<div data-testid="image-upload">
	<!-- Existing attachments -->
	{#if attachments.length > 0}
		<div class="mb-2 flex flex-wrap gap-2">
			{#each attachments as attachment}
				<div class="group relative">
					<img
						src="/api/notes/{noteId}/attachments/{attachment.id}"
						alt={attachment.filename}
						class="h-20 w-20 rounded object-cover"
						data-testid="attachment-thumbnail"
					/>
					<button
						onclick={() => onRemove(attachment.id)}
						class="absolute -right-1 -top-1 hidden rounded-full bg-red-500 p-0.5 text-white group-hover:block"
						aria-label="Remove attachment"
						data-testid="remove-attachment"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Upload area -->
	<div
		class="rounded-lg border-2 border-dashed p-4 text-center transition-colors {dragOver ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-300 dark:border-gray-600'}"
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={() => (dragOver = false)}
		role="button"
		tabindex="0"
		data-testid="upload-dropzone"
	>
		{#if uploading}
			<p class="text-sm text-gray-500">Uploading...</p>
		{:else}
			<label class="cursor-pointer">
				<span class="text-sm text-gray-500">Drop images here or <span class="text-amber-600 underline">browse</span></span>
				<input
					type="file"
					accept="image/*"
					multiple
					class="hidden"
					onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
					data-testid="file-input"
				/>
			</label>
		{/if}
	</div>
</div>
