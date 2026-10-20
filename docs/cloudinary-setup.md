# Cloudinary integration — Phase 3

The owner deferred hosted account setup. Local tests verify the upload authorization boundary, file validation, persistence and cleanup with an explicitly stubbed provider. A genuine Cloudinary upload/delivery has **not** been verified. The SDK adapter is implemented for later credential configuration.

Set `CLOUDINARY_ENABLED=true`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` only in private environment configuration. Never use NEXT_PUBLIC variables for credentials. Rebuild after changing the cloud name, because Next Image's remote host/path allowlist is generated at build time and restricted to that cloud's image-upload path.

## Operator upload

Until verified administrator Auth is available, there is no public upload/signature endpoint or unsigned upload widget. The authorized operator uses a local command with privileged database credentials. Before any network upload, the command checks that the database role may insert image records and the target product exists. The storefront reader is denied before contacting the provider. Phase 4/7 will connect this operation to verified administrator sessions and the admin UI; a client-supplied role is never sufficient.

Create a private JSON manifest with these fields:

```json
{
  "file": "C:/path/to/approved-product.jpg",
  "productId": "the-existing-product-uuid",
  "alt": "Accurate description of the product photograph",
  "provenance": "Owner or photographer, license/permission reference and date"
}
```

```powershell
pnpm image:upload path/to/manifest.json
```

The server streams a local file using authenticated SDK requests. Only JPEG/PNG/WebP, at most 5 MB, are accepted; magic bytes are checked, and Cloudinary must decode an allowed image format. The provider enforces a 40-megapixel cap. URLs, SVG and arbitrary browser upload parameters are not accepted. Public IDs are generated under `sd-catalog/<product-uuid>/<random-uuid>` with overwrite disabled. Database metadata includes provider asset/public IDs, version, dimensions, format, alt text and provenance; public URLs are constructed from those validated fields, not arbitrary stored URLs.

If persistence or returned metadata validation fails, cleanup targets only the new generated public ID. If cleanup itself fails, review that scoped asset in Cloudinary; no old image is deleted. Network timeout outcomes may require an operator to reconcile a newly created orphan asset before retrying. SDK errors/secrets are not returned to visitors or printed by the operator CLI.

When credentials are available, verify a small licensed image upload, responsive delivery in the configured cloud, persisted gallery order/alt text, rejected formats, privilege denial and failure cleanup. Record the genuine result separately from the current provider-stub tests. Do not enable unsigned uploads as a workaround.

References: [Cloudinary Node upload](https://cloudinary.com/documentation/node_image_and_video_upload), [Upload API](https://cloudinary.com/documentation/image_upload_api_reference).
