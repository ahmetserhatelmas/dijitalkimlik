alter table face_assets add column subject text not null default 'face';
alter table face_assets add column caption text not null default '';
alter table face_assets add constraint face_assets_subject_check check (subject in ('face', 'place', 'object'));
