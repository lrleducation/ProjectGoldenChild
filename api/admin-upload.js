const {json}=require('../lib/http');
const {requireAdmin}=require('../lib/security');

module.exports=async function(req,res){
  const user=requireAdmin(req,res);
  if(!user) return;

  return json(res,410,{
    message:'Your browser is running an old Project Golden Child uploader. Press Ctrl+F5 once and try again.'
  });
};
