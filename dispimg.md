 ExcelJS项目中解析WPS嵌入式单元格图片的技术方案
2026-02-04 05:14:16作者：明树来
背景介绍

在ExcelJS项目使用过程中，开发者经常遇到处理WPS表格中嵌入式图片的问题。这类图片以自定义函数形式嵌入单元格，与常规的浮动式图片不同，无法通过ExcelJS提供的标准API直接获取。本文将深入探讨这一技术难题的解决方案。
问题分析

WPS表格中的嵌入式图片具有以下特点：

    以=DISPIMG()函数形式存在于单元格中
    图片数据存储在Excel文件的特定位置
    无法通过worksheet.getImages()方法直接获取
    修改图片后可能导致读取顺序问题

技术解决方案
核心思路

解决这一问题的关键在于直接解析Excel文件的内部结构，特别是以下两个关键文件：

    xl/cellimages.xml：存储嵌入式图片的元数据
    xl/_rels/cellimages.xml.rels：存储图片资源的关系映射

实现步骤

    文件解压与读取：使用JSZip库解压Excel文件，获取上述两个关键文件的内容。

    建立图片映射关系：

    const cellimagesNameRidMap = {};
    cellimagesData['etc:cellImages']['etc:cellImage'].forEach((pic) => {
      const rid = pic['xdr:pic'][0]['xdr:blipFill'][0]['a:blip'][0].$['r:embed'];
      const imageId = pic['xdr:pic'][0]['xdr:nvPicPr'][0]['xdr:cNvPr'][0].$.name;
      cellimagesNameRidMap[rid] = imageId;
    });

    关联媒体资源：

    for (const relationship of cellimagesRelsData['Relationships']['Relationship']) {
      const data = relationship.$.Target.match(/media\/([a-zA-Z0-9]+[.][a-zA-Z0-9]{3,4})$/);
      if (!data) continue;
      const fullName = data[1];
      const [name, extension] = fullName.split('.');
      result[cellimagesNameRidMap[relationship.$.Id]] = workbook.media.find(v => v.name === name);
    }

    单元格遍历与匹配：

    if(value && value.result && value.result.indexOf('=DISPIMG(') === 0) {
      const id = value.result.match(/ID_[0-9A-F]{32}/i)[0];
      if (result[id]) {
        rows.push(Object.assign({ nativeCol: index + imageIndex }, result[id]));
      }
    }

技术要点

    XML解析：需要使用XML解析库处理Excel内部文件
    正则表达式：用于提取图片ID和媒体文件路径
    媒体资源匹配：将解析出的图片ID与ExcelJS的media资源关联
    单元格遍历策略：需要考虑表头行数等因素确定遍历起始点

应用场景

该方案特别适用于以下场景：

    处理WPS生成的Excel文件
    需要精确获取嵌入式图片的业务场景
    对图片位置有严格要求的数据处理流程

总结

通过直接解析Excel文件内部结构，我们可以有效解决ExcelJS无法直接读取WPS嵌入式图片的问题。这一方案不仅适用于WPS，也为处理其他特殊格式的Excel文件提供了思路。开发者可以根据实际需求调整实现细节，如处理多行数据、优化性能等。
