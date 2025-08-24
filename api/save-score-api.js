const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      phoneNumber, 
      overallScore, 
      parameterScores, 
      audioDataUrl, 
      sessionId,
      timestamp 
    } = req.body;

    // Validate input
    if (!overallScore || !parameterScores) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Upload audio to Supabase Storage if provided
    let audioUrl = null;
    if (audioDataUrl && phoneNumber) {
      try {
        // Convert data URL to buffer
        const base64Data = audioDataUrl.split(',')[1];
        const audioBuffer = Buffer.from(base64Data, 'base64');
        
        const fileName = `recording_${Date.now()}_${sessionId || 'anonymous'}.webm`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('vocal-recordings')
          .upload(fileName, audioBuffer, {
            contentType: 'audio/webm',
            cacheControl: '3600'
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('vocal-recordings')
            .getPublicUrl(fileName);
          audioUrl = publicUrl;
        } else {
          console.error('Upload error:', uploadError);
        }
      } catch (uploadErr) {
        console.error('Audio upload failed:', uploadErr);
        // Continue without audio - don't fail the entire save
      }
    }

    // Save assessment to database
    const { data, error } = await supabase
      .from('vocal_assessments')
      .insert({
        phone_number: phoneNumber || null,
        overall_score: overallScore,
        parameter_scores: parameterScores,
        audio_url: audioUrl,
        session_id: sessionId || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Generate shareable URL
    const shareUrl = `${process.env.VERCEL_URL || req.headers.origin}/share/${data.id}`;

    res.status(200).json({ 
      success: true, 
      id: data.id,
      shareUrl: shareUrl,
      message: 'Assessment saved successfully!'
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to save assessment',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}