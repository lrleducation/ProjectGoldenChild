const {json}=require('../lib/http');
const {requireAdmin}=require('../lib/security');

module.exports=async function(req,res){
  const user=requireAdmin(req,res);
  if(!user) return;

  return json(res,410,{
    message:'The image uploader has been upgraded. Refresh the admin page (Ctrl+F5) and try again.'
  });
};
