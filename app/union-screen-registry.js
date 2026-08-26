/* Canonical structural registry for Home -> Tu Sindicato and its Admin dashboard. */
(function () {
  'use strict';

  const entries = [
    { screen_key:'comite', title:'Comité Ejecutivo', description:'Conoce a tu representación', icon:'fist', frontend_route:{type:'module'}, authority_type:'supabase_table', authority_resource:'directory_members', admin_editor:{view:'directory_admin'}, section_permission:'documents.read' },
    { screen_key:'normas', title:'Normas y Reglamentos', description:'Estatutos vigentes', icon:'scale', frontend_route:{type:'module'}, authority_type:'supabase_table', authority_resource:'institutional_documents:regulation', admin_editor:{view:'documents_admin',kinds:['regulation'],title:'Normas y Reglamentos'}, section_permission:'documents.read' },
    { screen_key:'minuta', title:'Minuta de Acuerdos', description:'Últimas asambleas', icon:'folder', frontend_route:{type:'module'}, authority_type:'supabase_table', authority_resource:'minutes', admin_editor:{view:'minutes_admin'}, section_permission:'minutes.read' },
    { screen_key:'finanzas', title:'Secretaría de Finanzas', description:'Programas y contacto', icon:'finance', frontend_route:{type:'module'}, authority_type:'supabase_table', authority_resource:'institutional_programs', admin_editor:{view:'programs_admin'}, section_permission:'programs.read' },
    { screen_key:'convenios', title:'Convenios Suti', description:'Descuentos y alianzas', icon:'handshake', frontend_route:{type:'tab',target:'convenios'}, authority_type:'supabase_repository', authority_resource:'CompaniesRepository + agreements/benefits', admin_editor:{view:'convenios'}, section_permission:'agreements.read' },
    { screen_key:'formatos', title:'Descarga de Formatos', description:'Trámites y solicitudes', icon:'download', frontend_route:{type:'module'}, authority_type:'supabase_table', authority_resource:'institutional_documents:download/form', admin_editor:{view:'documents_admin',kinds:['download','form'],title:'Descarga de Formatos'}, section_permission:'documents.read' },
    { screen_key:'categoria', title:'Cambio de Categoría', description:'Propuestas y escalafón', icon:'swap', frontend_route:{type:'module'}, authority_type:'supabase_tables', authority_resource:'union_screen_content + union_content_blocks', admin_editor:{view:'union'}, section_permission:'union_content.read' },
    { screen_key:'antiguedad', title:'Agremiados por Antigüedad', description:'Reconocimientos', icon:'seniority', frontend_route:{type:'module'}, authority_type:'supabase_tables', authority_resource:'union_screen_content + union_content_blocks', admin_editor:{view:'union'}, section_permission:'union_content.read' },
    { screen_key:'jubilados', title:'Jubilados y Pensionados', description:'Apoyo permanente', icon:'retiree', frontend_route:{type:'module'}, authority_type:'supabase_tables', authority_resource:'union_screen_content + union_content_blocks', admin_editor:{view:'union'}, section_permission:'union_content.read' },
  ].map((entry) => Object.freeze(Object.assign({ id:entry.screen_key, label:entry.title, desc:entry.description }, entry, {
    frontend_route:Object.freeze(entry.frontend_route),
    admin_editor:Object.freeze(entry.admin_editor),
  })));

  const registry = Object.freeze(entries);
  window.UNION_SCREEN_REGISTRY = registry;
  window.UNION_SCREEN_BY_KEY = Object.freeze(Object.fromEntries(registry.map((entry) => [entry.screen_key, entry])));
  window.UNION_AUXILIARY_CLASSIFICATION = Object.freeze({ emergencias:'OBSOLETE' });
})();
