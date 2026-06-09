-- Allow authenticated users to upload only into their own reply-audio folder.
-- Comment audio: comments/{user_id}/{comment_id}.{ext}
-- Reply audio:  {user_id}/{reply_id}.{ext}

DROP POLICY IF EXISTS "reply_audio_upload" ON storage.objects;
DROP POLICY IF EXISTS "reply_audio_upload_own" ON storage.objects;

CREATE POLICY "reply_audio_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reply-audio'
    AND (
      (
        (storage.foldername(name))[1] = 'comments'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
      OR (
        (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );
