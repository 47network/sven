import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 833-837: Media Processing', () => {
  const verticals = [
    {
      name: 'image_resize_pipeline', migration: '20260624700000_agent_image_resize_pipeline.sql',
      typeFile: 'agent-image-resize-pipeline.ts', skillDir: 'image-resize-pipeline',
      interfaces: ['ImageResizePipelineConfig', 'ResizeJob', 'PipelineEvent'],
      bk: 'image_resize_pipeline', eks: ['imrp.job_received', 'imrp.source_loaded', 'imrp.variants_generated', 'imrp.outputs_persisted'],
      subjects: ['sven.imrp.job_received', 'sven.imrp.source_loaded', 'sven.imrp.variants_generated', 'sven.imrp.outputs_persisted'],
      cases: ['imrp_receive', 'imrp_load', 'imrp_generate', 'imrp_persist', 'imrp_report', 'imrp_monitor'],
    },
    {
      name: 'video_transcode_dispatcher', migration: '20260624710000_agent_video_transcode_dispatcher.sql',
      typeFile: 'agent-video-transcode-dispatcher.ts', skillDir: 'video-transcode-dispatcher',
      interfaces: ['VideoTranscodeDispatcherConfig', 'TranscodeJob', 'DispatcherEvent'],
      bk: 'video_transcode_dispatcher', eks: ['vtcd.job_queued', 'vtcd.profile_resolved', 'vtcd.encoder_invoked', 'vtcd.outputs_recorded'],
      subjects: ['sven.vtcd.job_queued', 'sven.vtcd.profile_resolved', 'sven.vtcd.encoder_invoked', 'sven.vtcd.outputs_recorded'],
      cases: ['vtcd_queue', 'vtcd_resolve', 'vtcd_invoke', 'vtcd_record', 'vtcd_report', 'vtcd_monitor'],
    },
    {
      name: 'audio_normalizer', migration: '20260624720000_agent_audio_normalizer.sql',
      typeFile: 'agent-audio-normalizer.ts', skillDir: 'audio-normalizer',
      interfaces: ['AudioNormalizerConfig', 'NormalizationJob', 'NormalizerEvent'],
      bk: 'audio_normalizer', eks: ['audn.job_received', 'audn.loudness_measured', 'audn.gain_applied', 'audn.output_emitted'],
      subjects: ['sven.audn.job_received', 'sven.audn.loudness_measured', 'sven.audn.gain_applied', 'sven.audn.output_emitted'],
      cases: ['audn_receive', 'audn_measure', 'audn_apply', 'audn_emit', 'audn_report', 'audn_monitor'],
    },
    {
      name: 'subtitle_generator', migration: '20260624730000_agent_subtitle_generator.sql',
      typeFile: 'agent-subtitle-generator.ts', skillDir: 'subtitle-generator',
      interfaces: ['SubtitleGeneratorConfig', 'SubtitleJob', 'GeneratorEvent'],
      bk: 'subtitle_generator', eks: ['sbtg.job_received', 'sbtg.audio_transcribed', 'sbtg.cues_aligned', 'sbtg.subtitle_emitted'],
      subjects: ['sven.sbtg.job_received', 'sven.sbtg.audio_transcribed', 'sven.sbtg.cues_aligned', 'sven.sbtg.subtitle_emitted'],
      cases: ['sbtg_receive', 'sbtg_transcribe', 'sbtg_align', 'sbtg_emit', 'sbtg_report', 'sbtg_monitor'],
    },
    {
      name: 'media_drm_packager', migration: '20260624740000_agent_media_drm_packager.sql',
      typeFile: 'agent-media-drm-packager.ts', skillDir: 'media-drm-packager',
      interfaces: ['MediaDrmPackagerConfig', 'PackagingJob', 'PackagerEvent'],
      bk: 'media_drm_packager', eks: ['mdrm.job_received', 'mdrm.keys_acquired', 'mdrm.streams_encrypted', 'mdrm.manifest_emitted'],
      subjects: ['sven.mdrm.job_received', 'sven.mdrm.keys_acquired', 'sven.mdrm.streams_encrypted', 'sven.mdrm.manifest_emitted'],
      cases: ['mdrm_receive', 'mdrm_acquire', 'mdrm_encrypt', 'mdrm_emit', 'mdrm_report', 'mdrm_monitor'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration))).toBe(true);
      });
      test('migration has correct table', () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration), 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });
      test('type file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', v.typeFile))).toBe(true);
      });
      test('shared barrel exports type', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`./${v.typeFile.replace('.ts', '')}`);
      });
      test('SKILL.md exists with Actions', () => {
        const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(skill).toContain('## Actions');
        expect(skill).toContain(v.skillDir);
      });
      test('Eidolon BK includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('Eidolon EKs all present', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => expect(types).toContain(`'${ek}'`));
      });
      test('event-bus SUBJECT_MAP entries present', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((s) => expect(eb).toContain(`'${s}'`));
      });
      test('task-executor switch cases present', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => expect(te).toContain(`case '${c}'`));
      });
      test('.gitattributes filters set', () => {
        const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
        expect(ga).toContain(v.migration);
        expect(ga).toContain(v.typeFile);
        expect(ga).toContain(v.skillDir);
      });
      test('districtFor includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
    });
  });
});
